# Next 1: HeroCat v1.1 implementation summary

Implements `ai/plan_1.md` (answering `ai/prompt_1.md`). Nothing is committed. All changes are in the working tree.

## What was built

| # | Request | Result |
|---|---|---|
| 1, 7 | More weapons to unlock; weapons cost more | 8 weapons, 4 of them new: Fishbone Spear, Thunder Hammer, Crystal Sword, Sunfire Blade. Locked ones show in the shop with a 🔒 and how to unlock them. "Defeat 75 monsters" shows progress, e.g. 31/75. A toast announces new shop items when they unlock. Wooden Club 80 → 150, Iron Claw-Blade 300 → 750. |
| 2 | Choose your name | New Game → "What's your hero's name?" (prefilled Pip, 12 characters max). Every story line, the speaker label, Biscuit's greeting, the Hero panel and the credits use the name. You can rename from the Hero panel (✎). Start over keeps the name. |
| 3 | Controls at the start | After the prologue, a "How to play" screen lists every control for the device being used (keyboard or touch) plus "How to win". It shows once per save, so existing saves see it once on their next Continue. The pause menu still has it. |
| 4 | Rats and bats respawn after 10 s | Each defeated rat or bat comes back at its own spawn point 10 s later, counted in game time (pause, menus and dialogue freeze the timer). It arrives with a puff and a 0.5 s grow-in during which it can't attack. Summoned helpers never come back. |
| 5 | Arrow showing where to go | A golden double chevron on the ground in front of the hero points to the next story goal: the next cave, the Lantern Tower, the boss, or the way out. It follows tunnels and walks around obstacles such as the fountain. It hides in menus and dialogue, during boss fights, near the goal, and after the game is won. |
| 6 | Rats and bats harder | Rat: 12 → 18 HP, hits for 1 → 2, a bit faster. Bat: 8 → 13 HP, a bit faster. Each takes 3 swings at the starting 6 damage (was 2). Gold drops are unchanged. |
| 8 | Different armor | A new body-armor slot that blocks a share of every hit. Knitted Sweater blocks 10%, Leather Vest 15%, Iron Chainmail 25%, Crystal Plate 35% and Sunguard Armor 50%. Each one shows on the cat. The HUD has a 🛡 % chip, the Hero panel a Defense card, and hit numbers show the reduced damage (e.g. `-1.5`). |

The shop now has tabs (Training · Weapons · Helmets · Armor). A green dot marks any tab with something you can afford.

## Measured (local)

| Check | Result |
|---|---|
| Unit tests (`npm test`) | 62 pass. New ones cover: prices and unlock rules, armor, damage-taken math, name cleaning, old saves loading, respawn timing, arrow goals, and the nav grid. The nav grid tests include following the arrow from the entrance to the boss in all 3 real cave maps. |
| E2E (`npm run test:e2e`) | 6 pass (desktop + Pixel 7). They cover: name entry, how-to-play, HUD, rename with HTML escaping, and Continue not re-showing help. The shop test walks the cat to Biscuit's stall and checks tabs, lock hints and buying armor. |
| Initial download (`npm run size`) | **171.8 KB gzipped** (budget 200, was 165.9) |
| Load time, 3 runs each, mobile throttling (150 ms RTT, 1.6 Mbps, 4× CPU) | Before: title usable **0.52 s**, world ready **2.08 s**. After: **0.52 s / 2.07 s**. No measurable change. `next_0` reported 0.3 s / 1.7 s under a lighter throttle profile. |
| Draw calls | +2 at the same spot (arrow + worn armor). Shader programs unchanged; the arrow and armor reuse the existing materials. Busiest village view 52 calls / 10.9k triangles; caves 30–40 calls / ≤ 9.1k (budget < 100 / 50k). |

These were checked visually in the dev build:
- name form, help on desktop and in landscape at 400 px tall
- arrow in the village and in cave 1
- all 5 armors and the 4 new weapons on the cat
- shop and Hero panel at phone width

## Deviations from plan_1

- **Arrow pathing:** the nav grid moves in 8 directions with diagonal steps costing √2, and looks up to 24 cells ahead. The plan's 4-direction search made the arrow point sideways (an L-shaped path) in open ground. A unit test now checks the arrow points within 12° of the goal across open ground.
- **Arrow size:** it sits 2.2 units ahead (plan: 1.7) and is 15% bigger, so the cat's head doesn't hide it when it points away from the camera.
- **Help screen:** the rows are tighter and the "Let's go!" button stays pinned at the bottom, so it's reachable on short landscape phones.
- **Unlock toast timing:**
  - For boss unlocks, the toast appears after the boss cutscene.
  - For "Save Whiskerwood" unlocks, it appears after the credits close.
  - Rescuing the smith keeps its own toast, so it doesn't also get a second, generic one.
- **Story text:** Elder Mittens' prologue and one of Luna's tips now mention the golden arrow. Luna's old "hold to keep swinging" tip was replaced, because the help screen covers it.
- **HUD:** the HP bar now redraws on the exact HP value, since armor makes HP fractional. The text still shows whole numbers.
- **Name length:** the input box limits names to 12 characters. Emoji count as 2, so at most 6 emoji fit.

## Bug fix found after implementation: the Rat Burrow boss was unreachable

This bug dates back to v1. A rock (`o`) in cave 1, row 9, column 11 sat in the only opening into the corridor to the boss room. Wall corners on both sides left about a 0.56-unit gap, but the hero is 0.9 wide. The old test only checked tile connectivity, where a rock tile counts as open floor, so it missed this.

- **Fix:** the rock moved 5 tiles west (row 9, column 6), into the open part of the same room.
- **Shared collision:** collision setup moved into `caveCollision(map)` in `src/world/cave.js`, which the game and the tests now share.
- **Prevention:** `tests/caves.test.js` now checks that a hero-sized walker can reach the boss, chest, smith and exit in every cave, with all rocks, crystals and braziers in place. The arrow walk test in `tests/guide.test.js` uses the same real collision.

## Added after plan 1: sound effects (chat request)

All sounds are synthesized with the Web Audio API in `src/engine/audio.js`, so there are no audio files. They add about 3 KB to the download (174.9 KB total).

- **When audio starts:** browsers only allow sound after the player taps or presses a key, so the audio engine starts on the first input.
- **The 26 sounds:**
  - **Combat:** swing, hit, boss hit, defeat, boss defeat, hurt, faint, boss slam, boss roar, summon or respawn pop. A soft "warning" sound plays when a monster starts winding up, so you can hear when to step away; bosses get a deeper one.
  - **Rewards:** coin pickups, which climb in pitch when you grab several in a row; chest; Sun Gem; placing a gem; fountain heal; level up; buy; equip; new items unlocked; and an ending fanfare.
  - **Interface:** button click; a "no" buzz at locked caves; a whoosh on level changes; and dialogue blips, with a different voice pitch per character (narration is silent).
- **Distance:** sounds in the world get quieter, and pan left or right, with distance from the hero. Ones more than 24 units away are skipped.
- **Overlapping sounds:** each sound has a minimum gap between repeats, so many coins or rats at once don't pile up.
- **Volume balance:** each sound was rendered offline in Chrome and its peak measured. Combat sounds peak at 0.2–0.45 of full scale, big moments around 0.5, interface sounds about 0.1, and blips 0.06. With 10 loud sounds stacked, the limiter keeps the peak at 0.86, so nothing clips.
- **Sound on/off:** press **M**, or use **Pause → Sound On/Off**. The choice is remembered per device in `localStorage` (`herocat.sound`), separate from the save. Audio is suspended while the tab is hidden.
- **Tests:** `tests/audio.test.js` runs every recipe against a fake Web Audio API to catch values browsers reject. It also checks that every sound the code plays exists, and that every sound is used.

## Next steps (suggested priority)

1. **Playtest the balance with a real player.** All numbers are in `src/game/balance.js`. Things to watch:
   - whether rats and bats now feel "a bit" harder or too hard at the start;
   - whether 10–50% armor feels noticeable;
   - whether the 75-kill Thunder Hammer arrives at a good time;
   - whether the post-game Sunfire Blade (6000) and Sunguard Armor (6500) are fun goals or a grind.
2. **Real devices** (everything so far is emulated):
   - how the on-screen keyboard affects the name form on Android and iOS;
   - joystick and touch feel (carried over from next_0).
3. **Arrow polish if needed:**
   - an on/off switch in the pause menu;
   - a small bouncing marker over the goal when it's on screen.
4. **More respawns?** Slimes, spiders and golems can respawn by adding `respawn: <seconds>` to their entry in `balance.js`.
5. **Small existing CSS bug:** `#ui button { font: inherit }` overrides `.big { font-weight: 800 }`, so "Let's go!" and the pause-menu buttons render at normal weight.
6. **Carried over from next_0:**
   - background music (sound effects are done);
   - bosses can hide the hero;
   - Cloudflare login and deploy;
   - accessibility (focus trap in panels, `aria-live` toasts);
   - gamepad support.
