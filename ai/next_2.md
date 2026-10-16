# Next 2: autoplay bot, gameplay videos, and a playtested bug-fix pass

Implements `ai/plan_2.md` (answering `ai/prompt_2.md`). Nothing is committed. All changes are in the working tree. The game URL used everywhere is https://cat.maize.live.

## What was built

| # | Request | Result |
|---|---|---|
| 1 | A script that autoplays the game as a human player | `?autoplay` loads a bot (a separate lazy chunk) that plays only through the player's controls: key presses, or the touch joystick and sword button, plus clicks on on-screen buttons. It notices red circles after a human reaction time, reads the story at a readable pace, and never changes game state. A virtual clock (`scripts/record/clock.js`) lets Node step it frame by frame, faster than real time for playtests, or one frame per video frame for recordings. |
| 2.1 | YouTube video, > 5 min, max level and score, one continuous game | `recordings/final/herocat-youtube-full-playthrough.mp4`: 2560×1440, 60 fps, 14:20, 2.0 GB, −14 LUFS. An 11 s cold open from the Gnawfang fight, then the whole game as one continuous run from the title screen (52 min of game time). The story and the boss fights play at 1×. Travel and farming are sped up and marked ▶▶, never cut. Whiskerwood is saved at 7:34 and max level is reached at 14:02: Lv 7/7, Sunfire Blade, Sunguard Armor, Golden Crown-Helm, 863 monsters, 25,222 gold earned, 0 faints. 11 chapters (pasted into `media/youtube.md`). Thumbnail: `recordings/final/herocat-youtube-thumbnail.jpg` (1280×720). |
| 2.2 | YouTube Short | `recordings/short-seed7/final.mp4`: 1080×1920, 60 fps, 51 s, 43 MB, −16 LUFS. The bot plays with the on-screen joystick (visible), starting from the save its YouTube run made before the Deep Dark. It beats Gnawfang in 29 s with 37 of 53 HP left. Hook text, "FINAL BOSS!", "YOU WIN!", end card with the URL. |
| 2.3 | Video for X | `recordings/final/herocat-x.mp4`: 1920×1080, 60 fps, 50 s, 18 MB. Eleven clips from the YouTube run, each boss clip ending on the win. X autoplays muted, so it has big captions, placed clear of dialogue boxes and panels. It ends on the URL card. |
| 3 | Title, description, post | `media/youtube.md`, `media/short.md` and `media/x.md`: titles, descriptions (the YouTube one has chapters), tags, upload settings, the X post (225 characters), video alt text, and an optional reply. Final run stats are filled in: 863 monsters, 25,222 gold earned, 0 faints. |
| 4 | Improve gameplay, fix bugs | 4 bugs fixed. The final boss rebalanced from bot playtest data. Synthesized background music. Run stats on the credits and Hero panel. See below. |

## The bot (`src/bot/`)

| File | Job |
|---|---|
| `perceive.js` | The only file that reads game internals. It builds a plain snapshot (hero, enemies, level spots, mode, panel). |
| `brain.js` (pure) | What to buy (strength gained per gold, where strength = damage × HP ÷ (1 − block)). When it's ready for a boss (a small fight model). Which cave to farm. |
| `fight.js` (pure) | Notices wind-ups after the reaction time. Steps out of red circles: best of 16 directions, never into walls, preferring the camera side of a boss. Hits during *recover*. Finishes a monster that dies before it strikes. |
| `nav.js` | Walks anywhere using the guide arrow's nav grid. |
| `driver.js` | Turns wishes into real events: 8-way keys with hysteresis, or touch pointer events on the joystick and sword button. |
| `autoplay.js` | Title → dialogue → panels → village errands → cave plans (farm / boss / leave), plus telemetry, invariant checks, a stuck watchdog and the recording hooks. |

**Profiles:**

| Profile | Reaction | Dodges | Behaviour |
|---|---|---|---|
| `pro` | 180 ms | 97% | Plays for the videos |
| `casual` | 350 ms | 60% | Waits until its fight model says it's ready |
| `kid` | 400 ms | 50% | Rushes each boss, and trains only after fainting twice against it |
| `monkey` | as `pro` | as `pro` | Also mashes random keys and buttons (except Start over) about once a second |

**Tools:**

| Command | What it does |
|---|---|
| `npm run bot:playtest -- --profile kid --seeds 1-6 --goal story` | A whole game takes about 10 s of real time with drawing off. Prints a table of boss times, fight lengths, faints, flees, problems and errors. |
| `--goal fight --rush --save '{…}'` | Win rates for one boss from a prepared save |
| `npm run record:youtube` / `record:short` | Captures: virtual clock → CDP screenshot per frame → x264. Sounds and music are logged, then rendered offline through the game's own recipes, mapped onto the video timeline, and loudness-normalised (−14 LUFS). |
| `--dry` | Gives a run's video length and chapters in seconds, without capturing |
| `node scripts/record/edit.js youtube \| x \| thumbnail` | Cold open, X cut, thumbnail |

## Bugs fixed

| # | Bug | Fix |
|---|---|---|
| B1 | `#ui button { font: inherit }` overrode every button class's weight and size: `.big`, `.buy`, `.tab`, `.seg`, the Skip button, the action button and the ✕. "Let's go!" and the menu buttons were thin. | The reset moved to `:where(#ui) button`, which has zero specificity. |
| B2 | A boss's helpers kept attacking during the 1.8 s Sun Gem moment. Fainting there dropped the pending `wait()`s, so the gem moment, the boss's last words, the portal and the unlock toast were lost. | Helpers flee in a puff (still dropping their gold, toast "…'s helpers ran away!"), and the hero can't be hurt until the scene ends. A level change now ends pending waits, and cutscenes check they're still in the same level. |
| B3 | The Space that closed a story box also swung the sword (Space means both "next" and "attack"). | `Input.holdOff()`: attack keys, fingers or the mouse button already held when a dialogue or menu closes are ignored until released. Unit-tested with a small fake DOM. |
| B4 | A respawning rat or bat could pop up on top of the hero. | It waits until the hero is at least 4 units away (`RESPAWN_CLEARANCE`). |

**What the bot found:**
- **Gnawfang was a difficulty wall at the Elder's advice** (see the balance table below).
- **No crashes or soft-locks:** `monkey` mashed buttons through 12 full games and none hit an invariant failure, a stuck report or a page error.
- **No stuck spots:** every profile reached every goal on every seed.

**Bot-side issues fixed along the way** (not game bugs):
- The faint screen opens while the game is still in `dead` mode, which the bot didn't handle at first.
- The first "stuck in dialogue" check counted the whole prologue instead of a single line.
- A boss win logged the hero's HP after Gnawfang's crown was equipped (+22 HP), so "HP left" read high (45/75 instead of 23/53). It now logs the frame before the win. Win rates were not affected.

## Gameplay changes

**G1–G4:** fleeing helpers (B2), respawn clearance (B4), and a pressed look on the touch sword button. Plus **run stats**: play time (menus and story text don't count), gold earned and faints are saved, and old saves get zeros. They show on the credits (4 cards) and on an "Adventure log" card in the Hero panel.

**G5 music** (`src/engine/music.js`):
- Four short looping songs written as note lists: village (gentle), saved (happy, after the 3rd gem and on the credits), cave (tense), boss (fast).
- Played by small Web Audio instruments through the same limiter as the sound effects, so there are no files and no licences.
- Songs crossfade, and the music is picked from what's happening each frame.
- There's a separate **Music On/Off** in the pause menu, remembered as `herocat.music`. `M` still mutes everything.

**G6 balance:** one change, from data. Win rate over 16 seeds, one attempt each:

| Gnawfang fight, kid / casual profile | Before (dmg 14, wind-up 0.9 s) | After (dmg 12, wind-up 1.05 s) |
|---|---|---|
| Lv 4/4, Iron Claw-Blade, Iron Helm, Chainmail (the Elder's old advice) | 0/16 · 0/16 | 0/16 · 2/16 |
| Lv 4/4 with the Moonsteel from the Deep Dark chest | 1/16 · 1/16 | 6/16 · 7/16 |
| Lv 5/5 with Moonsteel | 6/16 · 8/16 | 14/16 · 14/16 |

- The `pro` bot wins every time either way. Its fight gets a little longer (about 25 s → 28–45 s, depending on its level).
- The Elder now says "level **5**" (it said 4) and hints at the Deep Dark's treasure chest. Both lines are in `story.js`.
- Kid runs of the whole story now take 13–24 min with 2–4 faints. Before, they took 23–29 min with 3–4 faints, and never beat Gnawfang at Lv 5.

The Spider Queen was left alone: a kid wins 9/12 at Lv 3/3 and 12/12 at Lv 4/4.

**G7 (hero outline when a boss hides it): not done.** Telemetry counted boss-fight frames where the boss stands between the camera and the hero. With the bot's camera-side preference turned off, it happened in 2 of 36 boss fights, for 6% and 12% of those fights. Bosses come from the north, toward the camera, so it isn't worth extra draw calls.

## Measured

| Check | Result |
|---|---|
| Unit tests (`npm test`) | 87 pass (was 64). New tests cover: bot brain, bot fighting, recording edits (speed, timelines, chapters), music, input hold-off, run stats, respawn clearance and duration text. |
| E2E (`npm run test:e2e`) | 9 pass, 1 skipped (was 6). The new `autoplay.spec.js` has the bot win the first Sun Gem through real keyboard input on desktop and the touch joystick on the Pixel 7 profile, about 1 s each on the virtual clock. Its determinism test (desktop only, so the phone copy is skipped) plays the same seed drawn and not drawn and compares them. |
| Initial download (`npm run size`) | **178.4 KB gzipped** (budget 200, was 174.9). +3.5 KB for music, fixes and stats. The bot (about 9 KB) is lazy and is counted as lazy now. |
| Load time, mobile throttling (150 ms RTT, 1.6 Mbps, 4× CPU), median of 5 | Before (HEAD): title usable **0.24 s**, world ready **1.54 s**. After: **0.24 s / 1.55 s**, no measurable change. The 412×915 phone profile is timed from the first byte of the page (navigation commit), so a cold visit adds about one round trip on top. These numbers aren't comparable with next_1's (0.52 s / 2.07 s), which used a different script. Before and after were measured back to back with the same script. |
| Determinism | Exact. The seed-10 YouTube capture (50,928 drawn frames) matched its dry run: all 211 logged events had the same times, gold and kills, and both saves were byte-identical. The Short matched its dry run too. A new E2E test checks that the same seed, drawn or not, gives the same position, gold and kill trace over 1,800 frames. |
| Capture speed (Intel iGPU via ANGLE/GL, headless) | About 40 ms per 1280×720 frame and about 70 ms per 2560×1440 frame, including the screenshot. |

## Deviations from plan_2

- **More profiles:** a `kid` profile (rushes bosses) and goal `fight` with `--rush`/`--save`, added for win-rate sweeps. These were the most useful balance tools.
- **Seed choice:** YouTube uses seed 10: the closest Gnawfang fight of 12 scanned (23 of 53 HP left), and 0 faints. The Short uses seed 7: the closest of 12 scanned (37 of 53 HP). Most seeds win without being hit.
- **YouTube speed:** story at 1×, travel 2×, story-time farming 6×, post-game farming 14×. Notable moments (toasts, purchases, bosses) hold 1× for 2.5 s. The story reading pace is about 4 words/s.
- **Short framing:** recording-only camera `zoom=1.6`, because the portrait camera framed the cat too small. It also uses `read=skip` to keep it under a minute.
- **Determinism needed a fix:** drawing a frame makes three.js draw from `Math.random` (internal ids), so a run with drawing off went differently from its recording. The first YouTube capture (seed 9) came out 15 s shorter than its dry run, so it was discarded. The virtual clock now reseeds `Math.random` from (seed, frame) at the start of every frame. Dry runs and playtests now predict recordings exactly: verified frame by frame, by the Short matching its dry run, and by a new E2E test that fails without the fix.
- **Screenshots:** CDP emulation is per session. Without `Emulation.setDeviceMetricsOverride` on the recorder's own session, screenshots came out at CSS size (720p). Caught before the final renders.
- **Offline audio:** lives in `src/engine/audio-offline.js`, so it ships in the bot chunk, not the game chunk. `music.js` is in the game chunk (it plays in the game).
- **Build folder:** `--build-dir` lets a recording keep serving its build while another one rebuilds `dist/`.

## Next steps (suggested priority)

1. **Upload and post** (you): the files and copy are in `recordings/final/`, `recordings/short-seed7/` and `media/`. Decide YouTube's "Made for kids" setting.
2. **Commit, then deploy:** the music, fixes and balance change aren't live on cat.maize.live yet, and the videos show the new build. Deploying first keeps the game the same as the videos.
3. **A real child playtest** to check the `kid` profile's numbers, especially the Spider Queen at Lv 2–3 and Gnawfang at Lv 5.
4. **Post-game:** the `pro` bot needs about 40 min of farming after the story to max everything (Sunfire Blade and Sunguard Armor are about 11 min each). Possible ideas: boss rematches, or more respawning monsters in the Deep Dark.
5. **Attract mode:** the title screen could quietly run `?autoplay` after some idle time, like an arcade demo.
6. **Carried over:** accessibility (focus trap, `aria-live` toasts), gamepad support.
