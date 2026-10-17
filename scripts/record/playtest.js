// Lets the bot play many games faster than real time (nothing is drawn) and reports how they went:
// when each boss fell, how long fights took, faints, and anything that looks like a bug.
//
//   node scripts/record/playtest.js --profile casual --seeds 1-10 --goal story
//   options: --profile pro|casual|monkey  --seeds 1-10 | 3,7  --goal story|max|gem1…  --minutes 120
//            --parallel 4  --read skip|fast|full  --rec (use the recording settings)  --skip-build
//            --save '{"gemsFound":2,"gemsPlaced":2,"hpLevel":4,…}'  start from this save (fields over a new game)
//   Balance check, one boss attempt per seed:  --goal fight --save '{…}' --seeds 1-20
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { launch, openGame, runTurbo, serve } from './session.js';

const { values: a } = parseArgs({
  options: {
    profile: { type: 'string', default: 'pro' },
    seeds: { type: 'string', default: '1-5' },
    goal: { type: 'string', default: 'story' },
    minutes: { type: 'string', default: '150' },
    parallel: { type: 'string', default: '4' },
    read: { type: 'string', default: 'skip' },
    driver: { type: 'string', default: 'keys' },
    rec: { type: 'boolean', default: false },
    rush: { type: 'boolean', default: false },
    'skip-build': { type: 'boolean', default: false },
    out: { type: 'string', default: 'recordings/playtest' },
    save: { type: 'string' },
    tag: { type: 'string', default: '' },
  },
});

const seeds = a.seeds.includes('-') ? (([lo, hi]) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i))(a.seeds.split('-').map(Number)) : a.seeds.split(',').map(Number);
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

mkdirSync(a.out, { recursive: true });
const server = await serve({ skipBuild: a['skip-build'] });
const browser = await launch();

async function play(seed) {
  const params = { autoplay: a.profile, seed, goal: a.goal, read: a.read, driver: a.driver, check: '' };
  if (a.rec) params.rec = '';
  if (a.rush) params.rush = '';
  const save = a.save ? { v: 1, name: 'Pip', introSeen: true, helpSeen: true, ...JSON.parse(a.save) } : null;
  const { context, page, errors } = await openGame(browser, server.url, { params, save });
  const started = Date.now();
  let lastLog = 0;
  const run = await runTurbo(page, {
    maxMinutes: Number(a.minutes),
    onBatch: (st) => {
      if (st.t - lastLog >= 300) {
        lastLog = st.t;
        console.log(`  seed ${seed}: ${mmss(st.t)} ${st.level} gems ${st.gemsPlaced}/3 Lv ${st.hpLevel}/${st.damageLevel} gold ${st.gold} kills ${st.kills}`);
      }
      if (errors.length > 20) throw new Error(errors.slice(0, 5).join('\n'));
    },
  });
  await context.close();
  const ev = run.events;
  const pick = (name) => ev.filter((e) => e.event === name);
  const result = {
    seed,
    profile: a.profile,
    goal: a.goal,
    reached: run.stats.done,
    gameTime: run.stats.t,
    realSeconds: (Date.now() - started) / 1000,
    final: run.stats,
    bosses: pick('bossDefeated').map((e) => ({ type: e.type, at: e.t, fight: e.time, hpLeft: `${Math.ceil(e.hp)}/${e.maxHp}`, lv: `${e.hpLv}/${e.dmgLv}` })),
    gems: pick('gemPlaced').map((e) => e.t),
    faints: pick('faint').map((e) => ({ at: e.t, level: e.level, boss: e.boss })),
    flees: pick('flee').length,
    problems: [...pick('stuck'), ...pick('wedged'), ...pick('invariant'), ...pick('shopProblem')],
    errors: [...new Set(errors)],
    events: ev,
  };
  result.fight = ev.find((e) => e.event === 'done' && 'won' in e) ?? null;
  writeFileSync(`${a.out}/${a.profile}-${a.goal}${a.tag ? `-${a.tag}` : ''}-seed${seed}.json`, JSON.stringify(result, null, 1));
  return result;
}

const results = [];
const queue = [...seeds];
await Promise.all(
  Array.from({ length: Math.min(Number(a.parallel), seeds.length) }, async () => {
    while (queue.length) {
      const seed = queue.shift();
      console.log(`seed ${seed}: playing…`);
      try {
        results.push(await play(seed));
      } catch (err) {
        console.error(`seed ${seed} failed:`, err.message);
        results.push({ seed, failed: err.message, problems: [], errors: [err.message], bosses: [], faints: [] });
      }
    }
  }),
);
await browser.close();
await server.close();

results.sort((x, y) => x.seed - y.seed);
const lines = [
  `## Playtest: ${a.profile}, goal ${a.goal}, ${results.length} seeds`,
  '',
  '| Seed | Reached | Game time | Brute | Queen | Gnawfang | Faints | Flees | Problems | Errors |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...results.map((r) => {
    const boss = (type) => {
      const b = r.bosses.find((x) => x.type === type);
      return b ? `${mmss(b.at)} (${b.fight}s, ${b.hpLeft} HP, Lv ${b.lv})` : '—';
    };
    return `| ${r.seed} | ${r.failed ? 'failed' : r.reached ? 'yes' : 'no'} | ${r.gameTime ? mmss(r.gameTime) : '—'} | ${boss('brute')} | ${boss('queen')} | ${boss('gnawfang')} | ${r.faints.length} | ${r.flees ?? 0} | ${r.problems.length} | ${r.errors.length} |`;
  }),
];
const problems = results.flatMap((r) =>
  r.problems.map((p) => `- seed ${r.seed} @ ${mmss(p.t)}: ${p.event} ${p.what ?? ''} ${p.level ?? ''} (${p.x?.toFixed?.(1)}, ${p.z?.toFixed?.(1)}) ${p.plan ?? ''}`),
);
const errors = [...new Set(results.flatMap((r) => r.errors))];
if (problems.length) lines.push('', '### Problems', ...problems);
if (errors.length) lines.push('', '### Page errors', ...errors.map((e) => `- ${e.split('\n')[0]}`));
const fights = results.map((r) => r.fight).filter(Boolean);
if (fights.length) {
  const won = fights.filter((f) => f.won);
  const avg = (xs) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0);
  lines.push(
    '',
    `### Boss attempts: won ${won.length}/${fights.length}`,
    `- fight length: ${avg(fights.map((f) => f.fight)).toFixed(1)} s on average (won ${avg(won.map((f) => f.fight)).toFixed(1)} s)`,
    `- HP left when won: ${(100 * avg(won.map((f) => f.hp / f.maxHp))).toFixed(0)}% on average`,
  );
}
const md = lines.join('\n');
writeFileSync(`${a.out}/summary-${a.profile}-${a.goal}${a.tag ? `-${a.tag}` : ''}.md`, `${md}\n`);
console.log(`\n${md}`);
