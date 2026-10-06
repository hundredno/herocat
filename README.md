# herocat
defeat enemies

A small 3D browser game: a cat hero you name yourself (Pip by default) and a bamboo
sword set out to bring back Whiskerwood's three stolen Sun Gems. Built with Vite + three.js, deployed as a
static site on Cloudflare.

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
npm test            # unit tests (game rules, save data, collision, cave maps, guide arrow paths, respawns)
npm run test:e2e    # Playwright smoke tests against the production build (uses local Chrome)
npm run build && npm run size   # fails if the initial download is over 200 KB gzipped
```

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
| `src/engine/` | Renderer + adaptive quality, input (keys/touch), camera, collision, nav grid (arrow pathing), geometry builder, `audio.js` (synthesized sound effects, no audio files) |
| `src/world/` | Procedural models, village, cave builder; `caves/caveN.js` are ASCII maps (lazy-loaded) |
| `src/ui/` | HUD, dialogue, shop/hero/menu panels, floating numbers |
