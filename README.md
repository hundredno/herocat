# herocat
defeat enemies

A small 3D browser game: a cat hero you name yourself (Pip by default) and a bamboo
sword set out to bring back Whiskerwood's three stolen Sun Gems. Built with Vite + three.js, deployed as a
static site on Cloudflare. Play it at https://cat.maize.live

## Setup and run

```bash
npm install
npm run dev
```

In dev builds the game object is available as `window.__game` in the console.

## Initial setup

```bash
npm create vite@latest . -- --template vanilla
claude --dangerously-skip-permissions
```

## Test

```bash
npm test            # unit tests (game rules, save data, collision, cave maps, guide arrow paths, respawns, bot, music, recording edits)
npm run test:e2e    # Playwright smoke tests against the production build (uses local Chrome), incl. the bot beating the 1st boss
npm run build && npm run size   # fails if the initial download is over 200 KB gzipped
```

## Autoplay bot

Add `?autoplay` to the URL and a bot plays the game: a demo mode, a playtester and the
player in the videos. It only uses the player's controls (key presses, or the touch joystick
and sword button, and clicks on on-screen buttons). It reacts to red circles after a human
reaction time and never changes game state itself. Its code is a separate lazy chunk, so
normal players don't download it.

| URL option | Meaning |
|---|---|
| `autoplay=pro` · `casual` · `kid` · `monkey` | How well it plays. `kid` rushes bosses; `monkey` also mashes random buttons to find bugs |
| `seed=7` | Its own randomness (with the recording clock, the game's too) |
| `driver=keys` · `touch` | Keyboard, or the on-screen joystick (default: whatever the device has) |
| `read=full` · `fast` · `skip` | How long it lingers on story text and menus |
| `goal=max` · `story` · `gem1`…`gem3` · `fight` | When it stops (`fight`: after one boss attempt) |
| `check` | Checks rules every frame (nothing inside walls, HP in range, save round-trips…) and logs failures |

### Playtests

`scripts/record/playtest.js` lets the bot play many games faster than real time (nothing is drawn,
about 10 s for a full game) and prints a table of boss times, fight lengths, faints and problems:

```bash
npm run bot:playtest -- --profile kid --seeds 1-6 --goal story
# one boss attempt from a prepared save, 16 seeds: a win rate for balancing
npm run bot:playtest -- --profile casual --goal fight --rush --seeds 1-16 --save '{"gemsFound":2,"gemsPlaced":2,"hpLevel":5,"damageLevel":5}'
```

Results go to `recordings/playtest/` (gitignored).

## Recording videos

The recorder steps the game frame by frame on a virtual clock, screenshots each frame
into ffmpeg (smooth 60 fps at any resolution, HUD included), and renders the game's own
sounds and music offline from a log, so they're in perfect sync. Long grinding stretches
are fast-forwarded with a ▶▶ badge. Needs local Chrome and ffmpeg.

```bash
npm run record:youtube      # 2560×1440 full run to max level  → recordings/youtube-seed10/
npm run record:short        # 1080×1920 touch-controls Short   → recordings/short-seed7/
node scripts/record/edit.js youtube     # cold open + full run, and the chapter list
node scripts/record/edit.js x           # ~50 s 1080p highlight cut with captions for X
node scripts/record/edit.js thumbnail   # 1280×720 YouTube thumbnail
```

`--dry` prints a run's video length and chapters in seconds without capturing; `--preview`
records at half size and 30 fps. Titles, descriptions and posts are in `media/`.

`edit.js` times its cuts from the run's event log, so it works for any seed (`--from` picks the
run). For the thumbnail, `--at` (seconds into the final boss fight), `--focus x,y` and `--zoom`
choose and frame the shot. The long YouTube re-encode uses NVENC if the machine has it, else x264.

## Deploy


```bash
npx wrangler login
npm run deploy
```

`wrangler.jsonc` serves `dist/` as static assets, with preview URLs off. The version
label in the corner (`v.xxxx`) is the first 4 characters of the commit being built
(`WORKERS_CI_COMMIT_SHA` on Cloudflare builds, otherwise `git rev-parse HEAD`).

## Code map

| Path | What |
|---|---|
| `src/main.js` | Tiny entry: title screen + version label, loads the game chunk |
| `src/game.js` | Game loop, modes, level switching, story/combat glue |
| `src/game/` | Pure rules: `balance.js` (all numbers: gear, armor, enemies), `state.js` (save), `economy.js` (shop + unlock rules), `combat.js`, `story.js` (script + objectives), `guide.js` (where the arrow points), `respawn.js`; plus player/enemy/coin/particle/guide-arrow entities |
| `src/engine/` | Renderer + adaptive quality, input (keys/touch), camera, collision, nav grid (arrow pathing), geometry builder, `audio.js` (synthesized sound effects, no audio files), `music.js` (synthesized background music) |
| `src/world/` | Procedural models, village, cave builder; `caves/caveN.js` are ASCII maps (lazy-loaded) |
| `src/ui/` | HUD, dialogue, shop/hero/menu panels, floating numbers |
| `src/bot/` | Autoplay bot (lazy chunk, `?autoplay`): `perceive.js` (reads the game), `brain.js` (what to buy, when to fight bosses), `fight.js` (dodging and attacking), `nav.js`, `driver.js` (keyboard/touch input) |
| `scripts/record/` | Virtual clock, playtests, video recorder, overlays, edits (`cuts.js` is the pure, tested part) |
| `media/` | Video titles, descriptions and social posts |
