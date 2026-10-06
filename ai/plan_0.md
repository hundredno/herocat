# Plan 0 — HeroCat v1

Answers `ai/prompt_0.md`. Nothing here is implemented yet.

## 1. Goal

A small 3D browser game. A cat hero explores a village and three caves, fights enemies, collects gold, buys gear and upgrades HP/damage, and follows a short story to a final boss. It is a static site deployed to Cloudflare, and it must meet the CLAUDE.md spec:

- Interactive in 2–3 s (4 s hard cap) on an average connection.
- Runs well on integrated-GPU PCs and entry-level phones/tablets from the last 5 years, with touch support.

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite, vanilla JS** (matches README's `npm create vite@latest . -- --template vanilla`) | Fast, static output, tree-shaking |
| 3D | **three.js** (import only the modules used) | About 150 KB gzipped for what we need. Mature and runs on WebGL1/2 |
| Assets | **Procedural low-poly geometry built in code** (boxes, cones, spheres, merged) with flat colors and no textures | Almost nothing to download, which makes the load budget easy |
| UI/HUD | Plain HTML/CSS overlay on the canvas | Cheap, crisp, accessible, works with touch |
| State/save | `localStorage` (one JSON blob, versioned) | No backend needed |
| Tests | **Vitest** for pure game logic. One **Playwright** smoke test (page loads, HUD shows `HP 10/10`, version label present) | |
| Deploy | **Wrangler, Workers Static Assets** (`assets.directory = ./dist`) | Required by the prompt |

No physics engine. Collision is circle-vs-circle and circle-vs-AABB on a 2D ground plane, which is all this game needs.

## 3. Game design

### 3.1 Core stats (from the prompt)

- **HP**: base **10**. Max HP = 10 + HP-upgrade bonus + helmet bonus.
- **Damage**: base **5**. Total = 5 + damage-upgrade bonus + weapon bonus.
- Start with the **Bamboo Sword (+1)**, so the player deals **6** damage, as the prompt says.
- HUD in the **top-left** corner: `❤ 10/10`, `⚔ 6`, `🪙 0`.

### 3.2 Upgrades (HP and Damage, each levelled separately, Lv 1 → 7)

Cost to reach each level, as specified:

| To level | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|
| Gold | 50 | 100 | 250 | 500 | 1000 | 2500 |

The prompt doesn't say how much each level adds. Proposed:

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| HP bonus | 0 | +5 | +10 | +20 | +35 | +55 | +80 |
| Damage bonus | 0 | +2 | +4 | +7 | +11 | +16 | +22 |

*Assumption:* each cost is the price of that one step, not a running total. All numbers live in one `balance.js` table so they're easy to tune.

### 3.3 Equipment

Weapons add damage and helmets add HP. Only one of each is equipped (the best one owned is auto-equipped, and the player can switch in the inventory). Gear comes from chests and boss drops, or from the village shop.

| Weapon | +DMG | Source |
|---|---|---|
| Bamboo Sword | +1 | Start |
| Wooden Club | +3 | Shop 80g / Cave 1 chest |
| Iron Claw-Blade | +6 | Shop 300g / Cave 2 chest |
| Moonsteel Sword | +12 | Cave 3 chest |

| Helmet | +HP | Source |
|---|---|---|
| (none) | 0 | Start |
| Leaf Cap | +3 | Cave 1 chest |
| Acorn Helm | +8 | Shop 200g / Cave 2 chest |
| Iron Helm | +15 | Shop 600g |
| Golden Crown-Helm | +30 | Final boss |

### 3.4 Enemies (each has HP, damage, and a gold drop)

| Enemy | Where | HP | DMG | Gold |
|---|---|---|---|---|
| Cave Rat | Cave 1 | 12 | 1 | 5–8 |
| Bat | Cave 1–2 | 8 | 2 | 6–10 |
| Slime | Cave 2 | 30 | 3 | 15–20 |
| Spider | Cave 2–3 | 45 | 5 | 25–35 |
| Stone Golem | Cave 3 | 120 | 9 | 60–80 |
| **Boss: Big Rat Brute** | Cave 1 end | 60 | 3 | 60 |
| **Boss: Spider Queen** | Cave 2 end | 220 | 7 | 250 |
| **Final boss: Rat King Gnawfang** | Cave 3 end | 700 | 14 | 1000 |

When an enemy is defeated, a gold-coin pickup pops out and flies to the player, and the total is added. Respawning trash mobs in cleared caves allow grinding toward Lv 7.

### 3.5 Combat (real-time, simple, touch-friendly)

- Move: WASD/arrows on desktop, a virtual joystick (left thumb) on touch.
- Attack: Space/J/click or a big **⚔ button** (right thumb). A short sword swing in a front arc with a ~0.5 s cooldown that hits every enemy in the arc for the player's damage.
- Enemies chase when the player is close, telegraph an attack (wind-up flash for ~0.6 s), then hit for their damage if the player is still in range. Moving away dodges, which gives skill expression without complex controls.
- Brief i-frames after the player is hit. Floating damage numbers.
- **Death**: respawn in the village with full HP and keep half the carried gold. Gear and levels are never lost.
- HP fully restores at the village fountain and when entering a cave.

*Alternative considered:* turn-based combat. It's simpler, but less fun to "fight them" in 3D. Real-time with a single attack button stays accessible for kids and for touch.

### 3.6 Storyline (clear, told through short dialogue/comic panels)

Text boxes with a portrait, advanced by tap or Space and skippable. The current objective is always shown under the HUD (e.g. *"Objective: Find the Sun Gem in the Rat Burrow"*).

1. **Prologue – Whiskerwood Village.** Whiskerwood's warmth and light come from three **Sun Gems** on the village lantern tower. One night **Gnawfang the Rat King** steals them and hides them in three caves, and the village grows cold and dark. Elder Mittens gives the young cat **Pip** an old **Bamboo Sword**: "You're small, but you're brave. Be our hero." Ends with a tutorial on moving, attacking, and the shop.
2. **Chapter 1 – The Rat Burrow.** Rats and bats. Boss: Big Rat Brute. Reward: **Sun Gem 1**, and the village gets some colour back (the scene literally brightens).
3. **Chapter 2 – Crystal Hollow.** Slimes and spiders. Boss: Spider Queen. Reward: **Sun Gem 2**. A rescued blacksmith cat opens better gear in the shop.
4. **Chapter 3 – The Deep Dark.** Spiders and golems. Final boss: **Gnawfang**. The cave unlocks after Gem 2. The game recommends Lv ~4 upgrades before going in.
5. **Epilogue.** All three gems return and the tower lights up. Credits, and "HeroCat!" title card. Free play continues afterwards.

Cave gating: Cave 2 unlocks after Gem 1 and Cave 3 after Gem 2. A locked gate shows a rock with a hint.

### 3.7 World layout (small, cheap to render)

- **Village hub**: ground plane, about 6 low-poly houses, lantern tower, fountain (heal), shop stall (upgrades and gear), elder NPC, three cave entrances.
- **Each cave**: a separate scene of 3–4 connected rooms built from a simple tile grid (floor and wall boxes merged into one mesh), with enemy spawn points, a chest, and a boss room. Darker palette and fog per cave.
- Scenes are swapped on entry with a fade. Only one scene is in memory at a time.
- Camera: fixed-angle third-person follow (isometric-ish, about 50° pitch). No free camera, so controls stay simple and there's no occlusion problem.

## 4. Performance plan (spec targets)

**Load (first interaction within about 1–2 s):**
- `index.html` contains inline CSS and a lightweight **title screen** ("HeroCat!", Play/Continue) that's interactive before three.js finishes parsing.
- JS: one main chunk (three.js subset plus engine, target **≤ 200 KB gzip**). Cave scenes and story text are lazy-loaded with dynamic `import()` when first needed.
- No textures, models, or fonts to download (system font stack). Optional audio comes later and is lazy-loaded after first interaction.
- Hashed filenames plus long-cache headers via a `public/_headers` file. Brotli is applied automatically by Cloudflare.
- Add a CI-checkable bundle size budget script (`npm run size`) that fails if the main chunk is over the budget.

**Runtime (integrated GPU and entry-level phones):**
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))`, `antialias` off on mobile, `powerPreference: 'high-performance'` not requested.
- `MeshLambertMaterial` / `MeshToonMaterial`, one hemisphere light and one directional light, **no real-time shadow maps** (a blob shadow decal under characters instead).
- Merge static geometry per scene (one or a few draw calls). Use `InstancedMesh` for repeated props (rocks, crystals, coins). Target **< 100 draw calls, < 50k triangles**.
- Fog plus a short far plane.
- **Adaptive quality**: measure average frame time over 2 s. If it's over 20 ms, step the pixel ratio down (1.5 → 1.0 → 0.75) and turn off extra particles.
- Pause the render loop when the tab is hidden.
- Fixed-timestep game logic (60 Hz) separate from rendering.

**Verification:** Lighthouse mobile run (Slow 4G throttling) targeting TTI < 3 s. Chrome DevTools 4× CPU throttle to keep a stable ~30+ fps. Manual check on one real Android phone if one is available.

## 5. Version label

- Shown in the **bottom-right** corner, small and semi-transparent: `v.<first 4 chars of git commit>` (e.g. `v.2cb9`).
- Injected at build time with Vite `define: { __APP_VERSION__ }`, computed in `vite.config.js`:
  1. `process.env.WORKERS_CI_COMMIT_SHA` (Cloudflare Workers Builds) if set, otherwise
  2. `git rev-parse HEAD`, otherwise
  3. `dev`.
- Then `.slice(0, 4)`.

## 6. Cloudflare / Wrangler setup

`wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "herocat",
  "compatibility_date": "2026-10-01",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  },
  "workers_dev": true,
  "preview_urls": false
}
```

`package.json` scripts:

- `dev`: `vite`
- `build`: `vite build`
- `preview`: `vite preview`
- `test`: `vitest run`
- `test:e2e`: `playwright test`
- `size`: bundle budget check
- `deploy`: `npm run build && wrangler deploy`

`wrangler` goes in as a devDependency (4.x is already available locally), and `.wrangler/` and `dist/` are added to `.gitignore`.

## 7. Code structure

```
index.html              # canvas + HUD/overlay markup, inline critical CSS, title screen
vite.config.js          # version define, build target es2020
wrangler.jsonc
public/_headers         # cache headers for /assets/*
src/
  main.js               # boot: title screen → lazy start engine
  engine/
    renderer.js         # three renderer, resize, adaptive quality
    loop.js             # fixed-step update + render loop, visibility pause
    input.js            # keyboard + virtual joystick + attack button
    camera.js           # follow camera
    collision.js        # circle/AABB on XZ plane
  game/
    balance.js          # ALL numbers: base stats, upgrade costs/bonuses, gear, enemies
    state.js            # player state, derived stats, save/load (localStorage, versioned)
    combat.js           # pure functions: attack arcs, damage, death, drops
    economy.js          # pure: canUpgrade, upgrade, buy, gold
    story.js            # chapter/objective state machine + dialogue scripts
    enemies.js          # enemy AI (idle → chase → windup → attack → cooldown)
  world/
    models.js           # procedural low-poly cat, enemies, props (shared geometries/materials)
    village.js          # hub scene
    caves/cave1.js, cave2.js, cave3.js   # lazy-loaded
  ui/
    hud.js              # HP/DMG/gold top-left, objective, version bottom-right
    dialogue.js
    shop.js             # upgrades + gear
    inventory.js
tests/
  economy.test.js       # upgrade costs 50/100/250/500/1000/2500, max level 7
  combat.test.js        # 5 base + 1 bamboo = 6 dmg; helmet adds HP; drops
  story.test.js         # chapter gating
  e2e/smoke.spec.js
```

Pure logic (`balance`, `state`, `combat`, `economy`, `story`) has no three.js imports, so it can be unit tested directly.

## 8. Implementation order

1. **Scaffold**: Vite vanilla, three, vitest, wrangler config, version define, version label, `npm run deploy` working with an empty scene. *(This proves the deploy and version requirements first.)*
2. **Game logic core**: `balance.js`, `state.js`, `economy.js`, `combat.js` plus unit tests.
3. **Engine**: renderer, loop, input (keyboard and touch), follow camera, collision, adaptive quality.
4. **Village scene**: procedural cat hero, movement, HUD, shop UI (upgrades and gear), save/load.
5. **Cave 1**: rooms, rats and bats AI, combat feel (swing, hit flash, damage numbers, coin drops), boss, chest.
6. **Story system**: prologue, dialogue UI, objectives, gem return and village brighten.
7. **Caves 2 and 3**: new enemies, bosses, gating, epilogue.
8. **Polish and performance pass**: Lighthouse/throttled testing, size budget, touch layout on small screens, pause menu, settings (quality toggle, reset save).
9. **E2E smoke test and deploy.**

## 9. Assumptions and open questions

Proceeding with these defaults unless told otherwise:

1. **Upgrade bonus per level** isn't specified. I'm using the table in §3.2.
2. **Upgrade cost** is per step (50 for Lv 2, then 100 for Lv 3, and so on), not cumulative.
3. **Combat is real-time** with a single attack button, not turn-based.
4. **The hero's name is "Pip"** and the villain is Gnawfang the Rat King. Easy to rename.
5. **Sound/music** is out of scope for v1 (can be added later and lazy-loaded).
6. **Language** is English only.
7. "Top corner" for HP means the **top-left**. The version goes **bottom-right**. Touch controls sit at the bottom-left (joystick) and bottom-right above the version label (attack).
