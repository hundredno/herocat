# Next 0: HeroCat v1 implementation summary

Implements `ai/plan_0.md` (answering `ai/prompt_0.md`). Nothing is committed. All changes are in the working tree.

## What was built

The game is playable from start to end: title → prologue → village hub → 3 caves → 3 bosses → 3 Sun Gems → epilogue and credits → free play.

- **Stats from the prompt:** 10 HP, 5 base damage, and the Bamboo Sword (+1) for **6 damage**. HP is shown top-left. HP and Damage each upgrade Lv 1→7 for **50 / 100 / 250 / 500 / 1000 / 2500** gold per step.
- **Gear:** 4 weapons add damage and 4 helmets add HP. They come from the shop, chests, and the final boss. The best item auto-equips, and you can swap gear in the Hero panel (🎒 / B).
- **Enemies and gold:** 6 enemy types plus 3 bosses, each with HP and damage. Every enemy drops gold coins that fly to you. The red circle under an enemy is its attack warning; step out of it to dodge.
- **Story:** written dialogue with portraits, a typewriter effect, and a Skip button. The current objective is always shown under the HUD. Caves unlock one gem at a time. The village visibly brightens with each gem returned. The blacksmith side-quest unlocks iron gear.
- **3D:** three.js. Every model is low-poly geometry built in code with vertex colours, so there are no textures or model files to download.
- **Controls:** WASD/arrows + Space/click + E on desktop. On touch: a floating joystick on the left half of the screen, a sword button or tap on the right half, and a contextual action button.
- **Saving:** automatic, in localStorage. Saves are validated and repaired on load. Fainting keeps half your gold.
- **Version label** in the bottom-right corner: `v.<first 4 of commit>`. It reads `WORKERS_CI_COMMIT_SHA` on Cloudflare builds, otherwise `git rev-parse HEAD`.
- **Cloudflare:** `wrangler.jsonc` serves `dist/` as static assets with `preview_urls: false`. `npm run deploy` builds and deploys. `wrangler deploy --dry-run` passes.

## Measured (local)

| Check | Result |
|---|---|
| Unit tests (`npm test`) | 37 pass: economy, combat, story gating, save repair, collision, cave maps (reachability) |
| E2E (`npm run test:e2e`) | 4 pass, desktop + Pixel 7 profiles, using local Chrome |
| Initial download (`npm run size`) | **166 KB gzipped** (budget 200). Caves are lazy-loaded, 3.3 KB |
| Load, Slow 4G + 4× CPU throttle | title interactive **~0.3 s**, 3D world ready **~1.7 s** |
| Draw calls / triangles | village 15 / 9.4k, caves 28–38 / ≤ 9k (budget < 100 / 50k) |
| Shader programs | 7 total; every level uses the same light setup, so level switches never recompile |

## Deviations from plan_0

- **Game loop:** variable timestep split into ≤ 1/30 s substeps instead of a fixed 60 Hz step. It runs smoother on 90/120/144 Hz screens, and the physics is simple enough that determinism doesn't matter.
- **Levels:** caves are cached after their first load instead of keeping one scene in memory. They are tiny, and enemies respawn on each visit. Per-enemy geometry is freed when enemies are removed.
- **Inventory:** merged into `ui/shop.js` (`heroView`) instead of a separate `inventory.js`.
- **Gear sources:** Iron Claw-Blade and Iron Helm are sold only after rescuing Smith Whiskers in Crystal Hollow. Chests hold Leaf Cap (cave 1), Acorn Helm (cave 2) and Moonsteel Sword (cave 3). Gnawfang drops the Golden Crown-Helm.
- **Extra enemy:** Rat Guard, which Gnawfang summons.
- **Wrangler:** dropped `not_found_handling: "single-page-application"`. There's only one page, and a fallback would turn missing assets into HTML.
- **Extra performance work:** a small Vite plugin adds `modulepreload` for the game chunk, so it downloads alongside the entry script and saves a round trip.

## Next steps (suggested priority)

1. **Playtest on real devices**, especially an entry-level Android phone. Check touch feel, joystick size, and whether adaptive quality kicks in. Desktop and touch were only emulated.
2. **Balance pass with a real player.** All numbers are in `src/game/balance.js`. Things to watch:
   - the Spider Queen and Gnawfang fight length;
   - whether reaching Lv 4 before cave 3 feels grindy;
   - whether 1-damage rats are too easy.
3. **Sound:** small WebAudio-synthesised effects (swing, hit, coin, gem), lazy-loaded after the first interaction, plus optional music. Add a mute toggle to the pause menu.
4. **Bosses can hide Pip** when they stand between him and the camera. Ideas: draw an outline or silhouette of Pip through objects, or make big models in front of him semi-transparent.
5. **Cloudflare setup:** run `npx wrangler login`, then `npm run deploy`. For CI deploys, connect the repo to Workers Builds so `WORKERS_CI_COMMIT_SHA` sets the version label. A local deploy labels the build with the last commit, even if there are uncommitted changes.
6. **npm install scripts:** npm 11 held back the postinstall scripts for `esbuild` and `workerd`. Build, tests and the deploy dry-run all work without them. `wrangler dev` may need `npm install-scripts approve workerd`.
7. **Accessibility:** focus trapping inside panels, an `aria-live` region for toasts, a reduce-shake option.
8. **Later:** gamepad support, more caves or post-game content, a save format migration path (saves already carry `v: 1`).
