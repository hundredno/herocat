// The only part of the bot that reads the game's internals. Everything else works on the
// plain snapshot built here, the way a player works from what's on screen.
import { damageBlock, maxHp, totalDamage } from '../game/state.js';

const ids = new WeakMap();
let nextId = 1;
const idOf = (o) => {
  let id = ids.get(o);
  if (!id) ids.set(o, (id = nextId++));
  return id;
};

export function panelKind(view) {
  if (!view) return null;
  const c = ` ${view.className || ''} `;
  for (const k of ['help-view', 'faint', 'credits', 'shop', 'hero']) if (c.includes(` ${k} `)) return k === 'help-view' ? 'help' : k;
  return 'menu';
}

export function perceive(game) {
  const s = game.state;
  const p = game.player;
  const lv = game.level;
  const d = game.dialogue;
  return {
    mode: game.mode,
    started: game.started,
    panel: panelKind(game.panel.view),
    dialogue: d.open ? { typing: d.shown < d.full.length, text: d.full, line: d.index } : null,
    state: s,
    hero: {
      x: p.x,
      z: p.z,
      hp: p.hp,
      maxHp: maxHp(s),
      dmg: totalDamage(s),
      block: damageBlock(s),
      cooldown: p.cooldown,
      swinging: p.swing >= 0,
      dead: p.dead,
      holding: !!p.held,
    },
    level: lv.kind === 'village' ? { kind: 'village', id: 'village', index: -1 } : { kind: 'cave', id: lv.id, index: lv.def.index },
    world: lv.collision,
    bounds: lv.bounds,
    enemies: game.enemies
      .filter((e) => !e.dead)
      .map((e) => ({
        id: idOf(e),
        type: e.type,
        x: e.x,
        z: e.z,
        hp: e.hp,
        maxHp: e.maxHp,
        radius: e.radius,
        state: e.state,
        timer: e.timer,
        reach: e.def.reach,
        range: e.def.range,
        aggro: e.def.aggro,
        dmg: e.def.dmg,
        boss: e.boss,
        appearing: e.appear > 0,
      })),
    bossFight: game.boss && !game.boss.dead ? idOf(game.boss) : null,
    bossSpot: lv.boss ? { x: lv.boss.x, z: lv.boss.z, type: lv.boss.type } : null,
    talk: game.talkTarget?.id ?? null,
    spots: Object.fromEntries(lv.interactables.filter((it) => it.id).map((it) => [it.id, { x: it.x, z: it.z, r: it.r, kind: it.kind, active: !it.when || !!it.when(game) }])),
  };
}
