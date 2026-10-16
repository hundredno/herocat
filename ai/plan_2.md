# Plan 2: Autoplay bot, gameplay videos, and a bug-fix pass

Answers `ai/prompt_2.md`. Builds on the game described in `ai/next_1.md`. Nothing here is implemented yet.

## 1. Requests → what changes

| # | Request | Plan in one line | Section |
|---|---|---|---|
| 1 | A script that autoplays the game as a human player | An in-page bot (`?autoplay`) that only uses the player's controls: keys, touch stick, on-screen buttons. A Node script drives it frame by frame | §2, §3 |
| 2 | Game recordings | Offline, frame-exact capture: virtual clock → screenshot per frame → ffmpeg. Sound is rendered offline from a log of every sound the game played | §4 |
| 2.1 | YouTube video, > 5 min, max level and score, one continuous game | One unbroken session from **New Game** to **Lv 7 / Lv 7 with all gear**. Story and boss fights play at 1×. Grinding is sped up, with a visible ▶▶ ×N badge, never cut | §5.1 |
| 2.2 | YouTube Short | Vertical 1080×1920, ≤ 60 s: "tiny cat vs the Rat King", played with the touch joystick on screen | §5.2 |
| 2.3 | Video for X | 16:9 1080p, 45–75 s highlight cut from the YouTube master. Works on muted autoplay | §5.3 |
| 3 | Title, description, post | Drafts below; final copy goes in `media/` once the real run's stats and chapter times exist | §6 |
| 4 | Improve gameplay, fix bugs | Fix 4 bugs found by reading the code, plus whatever the bot finds. The bot doubles as a playtester and fuzzer. A few small improvements, then a balance pass based on measurements | §7, §8 |

I'll produce the video files and the copy. **I won't upload or post anything.** That's for you to do.

## 2. "Plays as a human": the rules the bot follows

- **Same inputs as a player.**
  - Keyboard: 8 directions, attack, `E`, `Esc`, `Space`.
  - Touch: stick drags and attack-button holds, sent as touch pointer events.
  - Clicks on the real on-screen buttons: shop, panels, dialogue, the name form.
  - It never writes game state, never calls game methods, and never teleports.
- **Sees what's on screen.** It reads positions, HP and the red attack circles from the game objects, as a player reads them from the screen. It ignores enemies outside the camera view.
- **Human reaction and pace.**
  - A red circle is noticed only after a reaction delay: 180 ms for the `pro` profile, 350 ms for `casual`.
  - Aim and timing get small amounts of noise.
  - Dialogue is held long enough to read. Shop tabs are browsed visibly.
  - Movement on keys changes direction with a short minimum hold, like a person.
- **Same rules.** It can take damage, faint and lose gold like anyone else.
- The videos say openly that an autoplay bot is playing (§6).

## 3. The bot

### 3.1 Files

```
src/bot/autoplay.js    entry: start(game, opts); runs before each game frame; telemetry log; watchdog
src/bot/perceive.js    the only file that reads game internals → a plain snapshot object
src/bot/brain.js       pure: what to do next (story step, errands, shopping list, boss readiness)
src/bot/fight.js       pure: combat moves (pick target, approach, attack, dodge red circles)
src/bot/nav.js         paths to any point, reusing engine/navgrid.js; stuck detection and unsticking
src/bot/driver.js      DOM input: keys (8-way, hysteresis) or touch (analog stick); clicks; typing; pacing
```

- **Loading.** `main.js` loads the bot only when the URL has `?autoplay`, as a separate lazy chunk, so normal players download nothing extra. Opening `/?autoplay` in a normal browser shows the cat playing live, as a demo mode.
- **URL options:**
  - `autoplay=pro|casual|monkey` picks the profile.
  - `seed=7` sets the seed.
  - `driver=keys|touch` picks keyboard or touch input.
  - `rec` turns on recording mode.
- **Hook.** The bot wraps `game.frame`, so it decides inputs right before the game reads them.
- **Snapshot.** Pure modules take a snapshot (`{ mode, panel, state, hero, enemies, level, interactables }`) instead of the game itself. That makes them unit-testable without three.js. If game internals change, only `perceive.js` needs updating.

### 3.2 Big picture: `brain.js`

**Outside of play mode:**

| Mode / panel | Bot does |
|---|---|
| Title | New Game → types the name (default "Pip") one key at a time → Start |
| Dialogue | Waits for the text to finish, holds for reading time (about 3.5 words/s, minimum 1.2 s), then advances. Short/X cuts skip some dialogue |
| Help ("How to play") | Clicks "Let's go!" after a 2 s look |
| Shop | Opens the right tab, buys from the shopping list, closes |
| Faint screen | "Wake up in Whiskerwood" |
| Credits | Holds 4 s, then "Keep playing" |

**In the village**, errands in order:
1. Carrying a Sun Gem → walk to the tower → `E`.
2. The shopping plan has something affordable → walk to Biscuit → `E` → buy.
3. Otherwise → walk into the cave mouth: the story cave if **ready**, else the best farming cave.

**In a cave:**
- **Story boss alive and the bot is ready** → follow the path to the boss and fight.
- **Otherwise farm:**
  - clear enemies, nearest by path first;
  - open the chest and free Smith Whiskers when nearby;
  - wait for respawns;
  - leave once the gold target is met.
- **Low HP away from a boss** → walk to the exit. Re-entering a cave heals fully, so this is what a smart player would do.

**Shopping plan** (pure, unit-tested):
- Power = `damage × maxHP / (1 − block)`.
- Buy greedily by power gained per gold.
- If a much better item is close to affordable, save for it instead of buying a cheap one.
- Over a whole run this ends with everything bought, which is the "max" state.

**Boss readiness** (pure):
- A simple fight estimate: swings needed vs the boss's attack cycles, its summons and its enrage.
- Expected damage taken after armor must stay under a profile threshold, e.g. 60% of max HP for `pro`.
- The threshold is tuned from telemetry (§7.3).

### 3.3 Fighting: `fight.js`

Enemies follow a fixed cycle: **chase → windup** (red circle fills) **→ strike → recover**.

**Dodging.** Once a red circle has been visible for longer than the reaction delay:
- If the hero is inside the danger radius (`reach + 0.225`) and can't kill that enemy before the strike, it steps out.
- It picks the best of 16 directions by:
  - clearance from every active red circle;
  - no wall within the next 0.6 s of travel (`CollisionWorld.overlaps`);
  - staying near its target.

**Attacking.**
- Hold attack when the target is in sword range (`1.7 + enemy radius`). The game's auto-aim turns the hero.
- Walk in during the enemy's *recover* window; that's the safe time to hit.
- Against bosses: wait just outside the boss's reach (Gnawfang 3.6 vs the sword's 3.0), then step in during recover for 1–2 swings.

**Crowds.** Avoid fighting 3 or more at once by backing toward open ground or a corridor.

**Camera-friendly tie-breaks.**
- The game's camera is south of the hero, so the bot prefers standing south of a boss.
- That keeps the boss from hiding the cat on screen (see next_0 #4) and makes better footage.

### 3.4 Navigation: `nav.js`

- One `NavGrid` per level, cached. The Dijkstra already used by the guide arrow handles any target: shop, tower, cave mouth, enemy, chest, exit.
- The path is re-planned about 5 times a second, or sooner when the target moves more than a cell.
- **Watchdog:**
  - no progress toward the goal for 8 s → unstick: half a second of sideways movement;
  - no progress for 30 s → log a **stuck** report (level, position, goal, screenshot). In playtests that's a bug.

### 3.5 Profiles

| Profile | Reaction | Dodges | Use |
|---|---|---|---|
| `pro` | 180 ms | ~95% | Videos |
| `casual` | 350 ms | ~60% (a random share of red circles is ignored) | Balance check: can a kid get through? |
| `monkey` | — | — | Bug hunting: mashes every input, opens and closes panels mid-cutscene, presses `E` during transitions, pauses during waits |

### 3.6 Telemetry

The bot logs `{ t, event, … }` for:
- level entered and left;
- boss aggro and boss defeated, with fight length;
- every purchase;
- faints;
- gems placed;
- level-ups;
- the game finishing;
- stuck reports;
- page errors.

The Node scripts use this log for chapters, speed changes, the playtest report and seed selection.

## 4. Recording pipeline

### 4.1 Why offline frame-stepping

| Option | Problems |
|---|---|
| Real-time screen capture | Wayland on this machine needs an interactive screen-share prompt. Quality depends on machine load. Audio needs a separate capture and sync |
| Canvas `captureStream` | Misses the HUD, dialogue and toasts, which are HTML |
| Playwright `recordVideo` | Low bitrate, no audio |

**Chosen:** stepping the game frame by frame on a **virtual clock**, with a screenshot of the full page after each frame. This gives:
- smooth 60 fps at any resolution, regardless of machine speed;
- the HUD included;
- free time-lapse (more game frames per video frame);
- sound in perfect sync, since it's rendered offline from a timestamped log.

Tools available locally: ffmpeg 8 (libx264, aac, nvenc), Google Chrome, and Playwright 1.63 (already a dev dependency).

### 4.2 Pieces

```
scripts/record/clock.js     browser init script: virtual time + seeded Math.random
scripts/record/overlay.js   browser script: title/chapter cards, ▶▶ ×N badge, live stats, 🤖 tag, end card
scripts/record/session.js   shared: build + preview server, launch Chrome, load /?autoplay&rec…, read the bot log
scripts/record/playtest.js  turbo runs without capture: N seeds × profile → JSON + markdown summary
scripts/record/record.js    capture run: frames → ffmpeg; sound log → offline render → mux; chapters
scripts/record/cuts.js      pure: speed controller, chapter list, the X cut's segment list (unit-tested)
scripts/record/thumbnail.js YouTube thumbnail (1280×720) from a chosen frame + an HTML text layer
```

npm scripts: `bot:playtest`, `record:youtube`, `record:short`, `record:x`. Output goes to `recordings/`, which is gitignored. Videos are never committed.

### 4.3 The virtual clock (`clock.js`, injected before any page script)

- **Replaces:** `requestAnimationFrame`, `cancelAnimationFrame`, `performance.now`, `Date.now`, `setTimeout`, `setInterval` and their clear functions.
- **`__clock.advance(n)`:** runs n frames of exactly 1/60 s. Each frame:
  1. Run due timers, then the rAF callbacks.
  2. **Drive CSS animations:** every `document.getAnimations()` entry is paused and has its `currentTime` set from virtual time. Toasts, damage-number rise, fades and HP shake then play at the right speed in the video.
  3. Yield one real macrotask, so promise chains settle on the same frame however frames are batched: transitions, cutscenes, already-cached cave imports.
- **Seeded randomness:** `Math.random` becomes mulberry32(seed), and the bot has its own seeded RNG. Same seed means the same run.
- **Cave chunks:** in recording mode the bot imports the three cave modules up front, so the game's own loads never wait on the network.
- **`noRender`:** a new flag in `game.frame()` skips only the WebGL draw. Turbo playtests and sped-up stretches render just the frames that get captured.

**Fallbacks** if the spike (§12, step 1) shows a problem:
- CSS animation control is flaky → emulate `prefers-reduced-motion`, which the game already supports, so animations become instant.
- Capture is too slow → 30 fps, or 1080p instead of 1440p.

### 4.4 Capturing frames

Loop, one output frame at a time:
1. `speed` = speed controller (§4.6).
2. `advance(speed)`, rendering only the last of those frames.
3. CDP `Page.captureScreenshot` (JPEG q≈92, `optimizeForSpeed`).
4. Write the JPEG to `ffmpeg -f image2pipe -c:v mjpeg -i - -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p`.

Nothing is written to disk between frames. Chrome runs headless. The spike decides the GPU flags; the fallback is SwiftShader with `--enable-unsafe-swiftshader`. Per-frame cost is measured in the spike; I expect 30–80 ms, so a 20-minute 60 fps video takes about 40–100 min to render, unattended.

**Recording-only seams** (only read when `?autoplay&rec` is in the URL):
- `renderer.js` accepts `dpr=2` and forced antialiasing. Normally the pixel ratio is capped at 1.5, and AA is off on touch devices.
- The `v.xxxx` label is hidden: uncommitted builds would show the previous commit's hash.

### 4.5 Sound

- `Sound.play()` gets split into two parts:
  - **gate:** gap limiting and distance → volume and pan, using `this.now()`;
  - **render:** builds the voice at time t on any audio context.

  The game behaves the same; tests cover both halves.
- In recording mode a `tap` logs `{ t, name, opts, vol, pan }` instead of playing. Once the capture finishes, the bot chunk's `renderAudio(log, from, to)` renders the log on an `OfflineAudioContext`:
  - in 30 s chunks, 48 kHz stereo;
  - using the same recipes as the game;
  - with times mapped through the speed map.

  Node writes the chunks to a WAV file.
- **Sped-up stretches:** combat sounds go through the gap filter in *video* time. Rewards (level-ups, purchases) still play. Coin streams are thinned.
- **Mixing:** `ffmpeg … -af loudnorm=I=-14:TP=-1.5` (the YouTube loudness target), AAC 320k.

### 4.6 Speed controller and chapters (`cuts.js`, pure)

- **The bot reports its intent every frame:**
  - `story`: dialogue, cutscenes, boss fights, gem moments, the shop → **1×**
  - `travel`: walking with no enemies near → **2×**
  - `farm`: grinding → **6–8×**
- **Rules:**
  - Speed changes ease over about 0.5 s.
  - Any notable event (toast, level-up, unlock, faint) holds 1× for 2.5 s.
  - The ▶▶ ×N badge shows whenever speed is above 1×.
- **Chapters** come from telemetry events mapped to video time. YouTube's rules apply: the first one at 0:00, at least 3 chapters, each at least 10 s long.

## 5. The three videos

| | YouTube | Short | X |
|---|---|---|---|
| Frame | 16:9, **2560×1440** (viewport 1280×720 @2×: big, readable UI on phones; a 1440p upload gets YouTube's better encode) | 9:16, **1080×1920** (540×960 @2×, touch mode) | 16:9, **1920×1080** (downscaled cut of the YouTube master) |
| Length | 12–20 min expected (must be > 5) | 45–60 s (limit: 3 min) | 45–75 s (limit: 2 min 20 s on a standard account) |
| fps / codec | 60, H.264 High CRF ~16, AAC 320k | 60, same | 60 (30 if over size), ~8 Mbps, AAC 128k, `+faststart` |
| Controls | Keyboard | Touch joystick + sword button visible | Keyboard |
| Overlay | Chapter cards, ▶▶ badge, live stats (time · kills · gold earned · Lv), 🤖 autoplay tag | Hook text, 🤖 tag | Big captions (most X views are muted) |

### 5.1 YouTube: "start to max level" in one continuous run

1. **0:00 cold open, about 12 s.** The best moment of Gnawfang's fight, taken from the same run, with a title card.
2. **The continuous run** from the title screen:
   - name → prologue → how to play;
   - Rat Burrow → Big Rat Brute → 1st gem → shop;
   - Crystal Hollow → rescue Smith Whiskers → Spider Queen;
   - The Deep Dark, Moonsteel chest → Gnawfang → the village lights up → credits.
3. **Post-game**, sped up: farm → Sunfire Blade, Sunguard Armor, HP Lv 7 and Damage Lv 7.
4. **Final screen:** the Hero panel showing everything maxed, plus the run's stats (§8 G3). End card: "Play free in your browser: {GAME_URL}".
5. **Seed selection.** Run 10–20 seeds in turbo, then pick one where:
   - the story has no faints;
   - Gnawfang is a close fight;
   - the length fits.

   Then capture that seed. The cold open is cut from the master, from a timestamp the telemetry provides.

### 5.2 Short: "Can a tiny cat beat the Rat King?"

- The capture starts from a save **made by the bot itself** in the long run, just before the Deep Dark. Touch driver, vertical.
- **Storyboard:**

| Time | What happens |
|---|---|
| 0–2 s | Hook text over Gnawfang's roar |
| 2–15 s | Cave fights at 2× |
| 15–45 s | Boss fight at 1×: summons, enrage, close calls |
| 45–55 s | Sun Gem → village lights up |
| 55–60 s | End card that loops back to the start |

- Framing: if the portrait camera is too far out, add a recording-only zoom setting.
- The alternative concept, "0 → HeroCat in 60 seconds" (the whole run as a time-lapse), is cheap to add later.

### 5.3 X: 60-second highlight

Cut from the YouTube master (`cuts.js` → ffmpeg trims + concat). No separate capture.
1. 3 s cold open (Gnawfang enrages).
2. Title card.
3. Montage: bamboo sword → first rat → Brute → shop upgrade → Spider Queen → Gnawfang → village lights up → max stats.
4. End card with the link.

Captions carry the story without sound.

## 6. Titles, descriptions, posts (drafts)

Final versions go in `media/youtube.md`, `media/short.md` and `media/x.md`. `{…}` fields are filled from the final run's telemetry. `{GAME_URL}` is needed from you (§13).

**YouTube** (pick one title, all ≤ 70 characters):
1. `HeroCat! Full Game to Max Level – Tiny Cat vs. 3 Bosses` ← recommended
2. `I Built a Bot to Beat My Cat Game – HeroCat Full Playthrough`
3. `HeroCat! Full Playthrough, Lv 7 & Every Weapon (No Commentary)`

```
A tiny cat with a bamboo sword wins back Whiskerwood's three stolen Sun Gems, in one
continuous run, all the way to max level.

▶ Play HeroCat free in your browser (PC, tablet or phone, no download): {GAME_URL}

This run is played by an autoplay bot that uses the same controls you do. Grinding is
sped up (marked ▶▶ on screen); story and boss fights are real time.

Final stats: HP Lv 7 · Damage Lv 7 · {kills} monsters · {goldEarned} gold earned · {playTime} · {faints} faints

Chapters
0:00 The Rat King (preview)
{chapters…}

HeroCat! is a small 3D adventure that loads in about a second. Beat monsters for gold,
train HP and damage to level 7, collect 8 weapons, 4 helmets and 5 armors, and defeat
the Big Rat Brute, the Spider Queen and Gnawfang the Rat King.

#HeroCat #indiegame #browsergame
```

Tags: `herocat, browser game, cat game, three.js, indie game, full playthrough, walkthrough, no commentary`.

**Short:**
- Title: `Can a tiny cat beat the Rat King? 🐱⚔️ #Shorts`
- Description: `One bamboo sword, three Sun Gems, one very angry Rat King. Play free in your browser: {GAME_URL} (played by an autoplay bot) #HeroCat #indiegame #gaming`

**X post** (≤ 280 characters):

```
A tiny cat. A bamboo sword. A Rat King who stole the sun. 🐱⚔️

HeroCat! is a free 3D adventure that runs right in your browser, on PC or phone, no download.

▶ {GAME_URL}

#indiegame #gamedev #threejs
```

- Video alt text: `Gameplay of HeroCat: a small orange cat with a sword fights rats, a spider queen and a giant rat king in low-poly 3D caves, then returns three glowing gems to a village tower.`
- Optional reply that builds the thread, only if it turns out to be true: `This footage was played by a bot I wrote that uses the same controls as a player. On its way it found {n} bugs.`

## 7. Bugs

### 7.1 Found by reading the code (will fix)

| # | Bug | Fix |
|---|---|---|
| B1 | **Big buttons lose their bold and size.** `#ui button { font: inherit }` beats `.big { font-weight: 800; font-size: 1.05em }`. This hits "Let's go!", the pause menu and the faint/credits buttons (next_1 #5) | Lower the reset's priority: `:where(#ui) button { font: inherit }` |
| B2 | **A boss's defeat scene can be lost.** Its summoned Rat Guards or spiders keep attacking during the 1.8 s Sun Gem moment. If the hero faints, `setLevel()` drops the pending `wait()`s, so the gem moment, the boss's last words, the portal and the unlock toast never happen. The gem still counts | G1 below. Also, the cutscene stops cleanly if the level changed while it waited |
| B3 | **Closing dialogue with `Space` also swings the sword.** `Space` means both "next" and "attack", and it's still held when play resumes | After a dialogue or panel closes, attack keys and touches that were already held are ignored until released |
| B4 | **A respawning rat or bat can pop up right on top of the hero** | Respawn waits until the hero is at least 4 units from the spawn point. `Respawns.update` takes a "blocked" check, which is unit-tested |

### 7.2 Found by the bot

- **`playtest` runs** (pro + casual × 10 seeds) and **`monkey` runs** check invariants every frame:
  - no page errors;
  - the hero and enemies are never inside a wall, and their positions are finite;
  - `0 ≤ HP ≤ max`, gold is a whole number ≥ 0;
  - any mode other than `play` returns to `play` within 30 s, unless the panel is waiting for the player;
  - the save survives a round trip through `sanitize`.
- **Stuck reports** (§3.4) point at collision traps and unreachable spots, like v1's blocked Rat Burrow corridor.
- Every bug found gets a regression test where possible, and is listed in `next_2.md`.

## 8. Gameplay improvements

| # | Change | Why |
|---|---|---|
| G1 | When a boss falls, its summoned helpers run off in a puff, still dropping their gold, and the hero can't be hurt while holding up the Sun Gem | Fixes B2. The victory moment always plays |
| G2 | Respawn waits for room (B4) | Fairness |
| G3 | **Run stats:** play time, gold earned and faints are saved (kills already exist). They show on the credits and on a new "Adventure log" card in the Hero panel | Gives the game, and the videos, an in-game "final score" screen |
| G4 | The touch sword button looks pressed while held | Feedback for real players. It also shows clearly in the Short |
| G5 | **Background music** *(recommended, can be dropped)*. Synthesized like the sound effects, so no files and no licensing: calm village theme (brighter with each gem), tense cave loop, boss loop, victory sting. A separate Music toggle in the pause menu. About 3 KB gzipped | It was already on the next_1 list. The videos need it, and it's rendered offline the same way as the effects |
| G6 | **Balance pass, measured first.** Only `balance.js` numbers change, with a before/after table | Replaces guessing (next_0/next_1 "playtest the balance") |
| G7 | **Hero outline when hidden behind a boss** *(only if the footage shows it)*: drawn only where the cat is covered, flat colour, no depth writes | Only worth the extra draw calls if it happens often |

**G6 targets** (proposed; the playtest report shows where the game stands):

| Measure | Target |
|---|---|
| Fight lengths, `pro` | Brute 10–20 s · Queen 25–45 s · Gnawfang 45–90 s |
| `casual` on each boss | Wins within 2 tries after following Elder's advice. No grind longer than ~5 min before a boss |
| Post-game, `pro` | Sunfire Blade and Sunguard Armor each take ≤ ~20 min of farming |
| Possible levers | Gold drops, respawn timers for slimes, spiders and guards in later caves, upgrade costs |

## 9. Code touched

```
src/main.js               ?autoplay → lazy import('./bot/autoplay.js') with the game + URL options
src/game.js               noRender flag; G1 (dismiss helpers, gem-moment invulnerability); B2 guard;
                          G3 stats counters; B4 respawn check
src/engine/input.js       B3 (ignore attack held across a modal); G4 pressed class
src/engine/audio.js       play() → gate + render; tap hook; renderAudio helper (tree-shaken from the game)
src/engine/renderer.js    recording-only dpr / antialias override
src/engine/music.js       NEW (G5): tiny step sequencer + 4 themes
src/game/respawn.js       blocked(spawn) check (B4)
src/game/state.js         playTime, goldEarned, faints (+ sanitize defaults)
src/ui/menu.js / shop.js  stats on credits + Hero panel; Music toggle
src/ui/ui.css             B1; G4
src/bot/*                 NEW (§3)
scripts/record/*          NEW (§4)
scripts/size-check.js     count the lazy bot chunk (and the music chunk, if lazy) as lazy, not initial
media/*.md                NEW: final titles, descriptions, posts, chapters
.gitignore                recordings/
package.json              bot:playtest, record:youtube, record:short, record:x
```

## 10. Tests

**Unit (Vitest):**
- `bot-brain`: shopping order for sample saves; readiness per boss; the next errand for each story stage (carrying a gem, can afford, ready or not).
- `bot-fight`:
  - inside a closing red circle, the chosen move gets out before the strike;
  - it never picks a direction into a wall, using a small `CollisionWorld`;
  - it attacks during *recover* and waits outside the reach during *windup*.
- `record-cuts`: speed easing and the 1× hold after events; chapter list (0:00 first, ≥ 3 chapters, ≥ 10 s each, `m:ss` format); the X cut adds up to its target length.
- `audio`: gate and render recipes still pass the fake Web Audio checks; the offline log maps through a speed map.
- `respawn`: a blocked spawn waits, then fires once the hero leaves.
- `state`: the new stats fields default correctly on old saves.

**E2E (Playwright, desktop):**
- `autoplay.spec.js`: a fresh game at `/?autoplay=pro&seed=1` on the virtual clock, turbo. Within ≤ 10 game-minutes the bot must:
  - place the 1st Sun Gem;
  - cause no page errors;
  - log no stuck reports.

  This is a whole-game regression test (collision, AI, story flow) and runs in about 30–60 s.
- The existing smoke tests stay as they are.

## 11. Performance check (CLAUDE.md spec)

- **Initial download:**
  - The bot is a lazy chunk, loaded only with `?autoplay` and never preloaded, so the initial download grows by only ~0.2 KB in `main.js`.
  - Music, if added, is +~3 KB (174.9 → ~178 KB of the 200 KB budget).
  - `npm run size` must stay green after the size-check fix in §9.
- **Rendering:** draw calls and shader programs are unchanged, unless G7 ships; then re-measure the boss rooms.
- **Load time:** re-run next_1's throttled load check (150 ms RTT, 1.6 Mbps, 4× CPU); 0.52 s to a usable title and 2.07 s to the world are the bar.

## 12. Implementation order

0. Setup: `npm ci` (this checkout has no `node_modules`). Get a green baseline from `npm test` and `npm run test:e2e`.
1. **Spike, go/no-go (≈ half a day).** Clock shim + 20 s capture (title orbit, walking, a toast, a fade) + sound log → muxed clip. Check:
   - canvas and HUD both appear in the frames;
   - CSS animations run at the right speed;
   - ms per frame at 1080p and 1440p, and the GPU flags;
   - two runs with the same seed give identical logs.

   Apply the fallbacks from §4.3 if needed.
2. **Bot:**
   1. perceive + keyboard driver + nav (village errands, dialogue, panels);
   2. combat;
   3. brain;
   4. telemetry + watchdog.

   Milestone: `pro` finishes the story on 10/10 seeds, with 0 stuck reports and 0 errors.
3. **Fixes:** B1–B4 and G1–G4, with tests.
4. **Bot as playtester:**
   - pro + casual × 10 seeds, plus monkey runs;
   - fix what turns up;
   - balance pass (G6), re-run, before/after table;
   - decide G7 from footage stats.
5. **Music (G5)**, if kept.
6. **Recording pipeline:** speed controller, overlays, offline audio + mux + loudnorm, chapters, touch driver for the Short, the X cut, thumbnail.
7. **Seed selection** → final renders: YouTube master → X cut; Short from the bot's pre-Deep-Dark save.
8. **Copy:** fill in titles, descriptions, posts and chapters in `media/`. Write `ai/next_2.md` with the playtest summary, bugs found, balance changes and render stats.

## 13. Assumptions and open questions

Proceeding with these defaults unless told otherwise:

1. **"Max level" = HP Lv 7 and Damage Lv 7, plus every weapon, helmet and armor.** "Score" = the run's stats (time, monsters, gold earned, faints): live in the video overlay, and in-game on the credits and Hero panel (G3). No new points system or leaderboard. Say if you want a real score.
2. **One continuous session, with grinding sped up on screen and never cut.** Pure real time would probably run 60–90 minutes to reach max level.
3. **Bot transparency.** The videos and copy say an autoplay bot is playing, using the player's controls. That's honest, and the "I made a bot" angle is a good hook.
4. **`{GAME_URL}`.** I need the public link (a workers.dev subdomain or a custom domain). Until the site is deployed, the copy and end cards keep a placeholder.
5. **`?autoplay` stays on the live site** as a demo mode. It's lazy, costs nothing at load, and exposes nothing that matters in a single-player game. The alternative is to strip it from production builds.
6. **Music (G5) gets added.** The alternative is sound effects only, in both the game and the videos.
7. **YouTube's "Made for kids" setting is yours to choose at upload.** The game's audience suggests yes, which turns off comments and personalised ads.
8. **Commits and storage.** Recordings stay out of git (`recordings/`). Scripts and the final copy (`media/`) are committed by you as usual. Recordings hide the version label, so uncommitted builds don't show a stale hash.
9. **The hero is named "Pip"** in all videos.
10. **The X video is 16:9**, reusing the master. A square 1080×1080 cut would fill more of a phone feed but needs its own capture. Say if you want it.
