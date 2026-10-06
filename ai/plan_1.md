# Plan 1 — HeroCat v1.1: more gear, names, guidance, tougher caves

Answers `ai/prompt_1.md`. Builds on the game described in `ai/next_0.md`. Nothing here is implemented yet.

## 1. Requests → what changes

| # | Request | Plan in one line | Section |
|---|---|---|---|
| 1 | More weapons to unlock | 4 new weapons (8 total). Most unlock through story progress or a kill count, then are sold at the shop | §2 |
| 2 | Choose your name at the start | A name box after **New Game** (default "Pip"). The name is used in every line of story text | §3 |
| 3 | Show all controls at the start | A full "How to play" screen right after the prologue, before you can move. It's tailored to keyboard or touch | §4 |
| 4 | Rats and bats respawn after 10 s in the cave | Each defeated rat or bat comes back at its spawn point 10 s later, with a small "pop-in" | §5 |
| 5 | An arrow showing where to go | A golden arrow on the ground next to the hero that points to the next story goal. Inside caves it follows the tunnels | §6 |
| 6 | Rats and bats a bit harder | More HP, rats hit for 2, slightly faster attacks | §7 |
| 7 | Weapons cost more | Wooden Club 80 → 150, Iron Claw-Blade 300 → 750. New weapons are priced up to 6000 | §2 |
| 8 | Different armor you can wear | A new **Armor** slot (body armor) next to weapon and helmet. Armor blocks a % of every hit. 5 pieces, visible on the cat | §8 |

All numbers stay in `src/game/balance.js` so they're easy to tune.

## 2. Weapons: more of them, unlockable, pricier (requests 1 and 7)

### 2.1 The weapon list

Existing weapons keep their damage. Only their prices go up.

| Weapon | +DMG | Price | Unlocks when… | New? |
|---|---|---|---|---|
| Bamboo Sword | +1 | — | You start with it | |
| Wooden Club | +3 | **150** (was 80) | Available from the start | |
| Fishbone Spear | +4 | 350 | You beat the Big Rat Brute (1st Sun Gem) | ✅ |
| Iron Claw-Blade | +6 | **750** (was 300) | You rescue Smith Whiskers | |
| Thunder Hammer | +8 | 1200 | You defeat 75 monsters (shop shows progress, e.g. 23/75) | ✅ |
| Crystal Sword | +10 | 2000 | You beat the Spider Queen (2nd Sun Gem) | ✅ |
| Moonsteel Sword | +12 | — (find it) | Chest in the Deep Dark (unchanged) | |
| Sunfire Blade | +18 | 6000 | You save Whiskerwood (post-game goal) | ✅ |

Why this shape:
- There's something new to unlock after every story milestone.
- One unlock is tied to the kill count, which gives the respawning rats and bats (§5) a purpose beyond gold.
- Sunfire Blade gives free play a long-term goal.
- Crystal Sword (+10, 2000 g) is a choice before the final cave: buy it now, or save for training and rely on finding Moonsteel (+12).

### 2.2 Generic unlock rules (replaces `needsSmith`)

Each item can have `unlock: '<rule id>'`. The rules live in one table in `economy.js`:

```js
export const UNLOCKS = {
  brute: { test: (s) => s.gemsFound >= 1, hint: 'Beat the Big Rat Brute' },
  smith: { test: (s) => s.smithRescued, hint: 'Rescue Smith Whiskers' },
  kills75: { test: (s) => s.kills >= 75, hint: (s) => `Defeat 75 monsters (${Math.min(s.kills, 75)}/75)` },
  queen: { test: (s) => s.gemsFound >= 2, hint: 'Beat the Spider Queen' },
  saved: { test: (s) => s.finished, hint: 'Save Whiskerwood' },
};
```

- `canBuy` returns `{ ok: false, reason: 'locked', hint }` until the rule passes.
- Iron Claw-Blade and Iron Helm switch from `needsSmith: true` to `unlock: 'smith'`. Their behaviour doesn't change.
- **Unlock toasts:** `Game` keeps the set of currently unlocked item ids in memory. It's seeded on start, so nothing re-announces after a reload. After any event that can unlock something (enemy defeated, boss defeated, smith rescued, gem placed, game finished), it compares the set and shows a toast, e.g. "🔓 New at Biscuit's shop: Fishbone Spear, Leather Vest!"

### 2.3 Models

`weaponModel()` in `models.js` gets 4 new procedural cases, following the existing low-poly style:
- Fishbone Spear: a long pale shaft with rib "bones".
- Thunder Hammer: a chunky head with a yellow glow stripe.
- Crystal Sword: a glowing cyan blade.
- Sunfire Blade: a gold-and-orange glowing blade.

A model is only built when its weapon is equipped, so this adds no load cost.

## 3. Choose your name (request 2)

### 3.1 Flow

1. Title screen → **New Game**. The existing "tap again to start over" confirmation stays when a save exists.
2. The buttons are replaced by a small form:
   - **What's your hero's name?**
   - Text box prefilled with `Pip`, text selected, autofocused, `maxlength` 12, `enterkeyhint="go"`.
   - **Start adventure!** button, plus a small "◀ Back" link.
3. Submitting calls `game.start(true, name)`. **Continue** keeps the saved name.

The form is plain HTML in `index.html` plus about 30 lines in `main.js`. It belongs to the tiny entry chunk and doesn't wait for three.js, so load time is unaffected.

### 3.2 Data and safety

- `state.name` is added with default `'Pip'`. A pure `cleanName(raw)` in `state.js`:
  - trims and collapses whitespace,
  - strips control characters,
  - cuts the name to 12 characters, counted by code point so emoji aren't split,
  - falls back to `'Pip'` if the result is empty.
- `sanitize()` runs `cleanName` on load, so old saves become "Pip".
- The name is player-supplied text. Dialogue already uses `textContent`. The shop, hero panel and credits build HTML strings, so they will use a new `escapeHtml()` in `ui/dom.js`.

### 3.3 Using the name everywhere

- In `story.js`, every hard-coded "Pip" in `SCRIPTS` and villager lines becomes `{name}`. The speaker id `pip` stays as an internal key.
- `Dialogue` receives a `vars()` callback from `Game`. `showLine()` fills in `{name}` and uses it as the speaker name for `pip`.
- `shop.js` (Biscuit's greeting, "Pip the HeroCat" header) and `menu.js` (credits) read `game.state.name`.
- **Rename:** the Hero panel gets a small ✎ button next to the name. It swaps in the same input. This matters mainly for existing saves, which would otherwise be stuck with "Pip".

## 4. "How to play" at the start (request 3)

- New order for a fresh game: **name → prologue → How to play screen → play**. Showing it just before the player takes control is when it's most useful.
- The screen is the existing `helpView` in `menu.js`, expanded. It's shown in a mode that has a big **"Let's go!"** button instead of "◀ Back". The pause menu keeps its "How to play" entry. `Game.showHelp()` returns a promise that resolves when the panel closes, so `start()` can simply `await` it.
- It lists **every** control for the current input mode:

| | Keyboard / mouse | Touch |
|---|---|---|
| Move | `W A S D` or arrow keys | Drag on the left half of the screen |
| Attack | `Space` / `J` / left click (hold to keep swinging) | Hold the ⚔ button or the right half of the screen |
| Talk / use / open | `E` or `Enter` | Tap the orange button that pops up |
| Hero & gear | `B` | 🎒 button (top right) |
| Pause / menu | `Esc` or `P` | ⏸ button (top right) |
| Story text | `Space` next, `Esc` skip | Tap the text box, or **Skip** |

  Keys are drawn as small `<kbd>` keycaps.
- The screen also has a short **How to win** list:
  - follow the golden arrow;
  - a red circle means an attack is coming, so step out of it;
  - gold → Biscuit's shop (training, weapons, helmets, armor);
  - the fountain heals you;
  - progress saves automatically.
- A new `state.helpSeen` flag means the screen is shown **once per save**. Existing saves see it once on their next Continue, which also introduces the arrow and armor to them.
- The 5.5 s controls toast after the prologue is removed, because this screen replaces it.

## 5. Rats and bats respawn after 10 s (request 4)

- `balance.js`: `rat` and `bat` get `respawn: 10` (seconds). Any other enemy can opt in later the same way.
- When `setLevel()` spawns enemies from the map, each enemy remembers its spawn point (`e.spawn`). Summoned enemies (Rat Guards, Spider Queen's spiders) have none, so they never respawn.
- When a map-spawned enemy with `respawn` is defeated, `{ spawn, t: 10 }` is pushed onto a respawn queue. The queue is a small pure helper in `src/game/respawn.js` so it can be unit tested.
- The queue counts down in `step()`, which means game time. Pausing, dialogue and the shop all freeze it. At 0 the enemy re-spawns at its original point:
  - a puff of particles;
  - a 0.5 s grow-in, during which its AI is paused so it can't attack the instant it appears.
- The queue is cleared in `setLevel()`. Leaving and re-entering a cave still resets every enemy, as it does today.
- There are no extra limits needed: there's only ever one enemy per spawn point.

## 6. Guide arrow (request 5)

### 6.1 What the player sees

- A flat, bright golden chevron on the ground about 1.7 units in front of the hero. It points toward the next goal and gently "nudges" forward and back.
- It uses the existing `glowMat` (unlit, vertex colours), so there's **no new shader program**. It costs 1 draw call and a few dozen triangles.
- It's hidden:
  - outside `play` mode (title, dialogue, panels, fainting);
  - when the hero is within ~3.5 units of the goal;
  - when there is no goal (after the game is finished).

### 6.2 Where it points (pure logic, `src/game/guide.js`)

| Where you are | Situation | Arrow points to |
|---|---|---|
| Village | Carrying a Sun Gem | Lantern Tower |
| Village | Otherwise, gems placed < 3 | Entrance of the next cave (`gemsPlaced`) |
| Village | Game finished | (hidden) |
| Cave *i* | It's the current cave and its boss is still alive | Boss room |
| Cave *i* | Gem already found here, or you're replaying an old cave | The nearest way out: exit, or the boss portal once it's open |

The optional side goals (chests, the trapped smith) are not targeted. The arrow follows the main story so it never sends a kid somewhere optional.

### 6.3 Following tunnels, not walls

A straight line would point into cave walls, and in the village it would point through the Lantern Tower toward the middle cave. To avoid that, there's a small navigation grid, `src/engine/navgrid.js`, which is pure with no three.js:

- It's built from the level's existing `CollisionWorld`. It samples a 1-unit grid over the level bounds and marks cells that a circle the size of the hero would overlap. This uses a new non-moving query, `CollisionWorld.overlaps(x, z, r)`.
- **Flow field:** a breadth-first search from the goal cells (several sources are allowed, e.g. exit + portal) gives each cell its distance to the goal. It's recomputed only when the goal changes or a collider is toggled (boulder rolls away, smith freed). The grid is about 1.5k cells, so this takes well under 1 ms.
- **Each frame:** from the hero's cell, walk up to 4 cells downhill and aim at the farthest of those cells that is in a straight, clear line. The arrow's angle is smoothed so it doesn't jitter at corners.
- The same code serves the village and all three caves.

## 7. Tougher rats and bats (request 6)

| | HP | DMG | Speed | Wind-up (s) | Gold |
|---|---|---|---|---|---|
| Cave Rat | 12 → **18** | 1 → **2** | 2.8 → 3.0 | 0.6 → 0.55 | 5–8 (same) |
| Bat | 8 → **13** | 2 (same) | 3.6 → 3.9 | 0.5 → 0.45 | 6–10 (same) |

- At the starting 6 damage, a rat takes 3 swings (was 2) and a bat takes 3 (was 2). At 10 HP the hero can take 5 rat hits (was 10).
- The red-circle warning is still long enough to dodge.
- It's "a bit harder" rather than a wall: one cheap upgrade fixes it. Damage Lv 2 (50 g) or the Wooden Club brings both back to 2–3 swings.
- Gold drops stay the same, because respawning (§5) already raises gold per minute. The Big Rat Brute is unchanged (60 HP, 3 DMG).

## 8. Armor (request 8)

### 8.1 Design

A third equipment slot, **Armor**, sits alongside Weapon (+damage) and Helmet (+max HP). Armor **blocks a share of every hit**. That gives it its own job instead of being a second helmet, and it matters more as enemies hit harder.

| Armor | Blocks | Price | Unlocks when… |
|---|---|---|---|
| Knitted Sweater | 10% | 150 | Available from the start |
| Leather Vest | 15% | 400 | You beat the Big Rat Brute |
| Iron Chainmail | 25% | 1000 | You rescue Smith Whiskers |
| Crystal Plate | 35% | 2200 | You beat the Spider Queen |
| Sunguard Armor | 50% | 6500 | You save Whiskerwood |

### 8.2 Damage rule

`damageTaken(dmg, block) = dmg × (1 − block)` lives in `combat.js` and is unit tested.

- **No rounding.** A flat "−1 per hit" would make the cheap armor cancel rat damage completely, because enemy damage numbers are small (2–14). Rounding a % would make the first armors do nothing at all.
- Player HP is already fractional internally, and the HUD already shows `ceil(hp)`, so fractional damage fits what's there.
- The damage floater shows one decimal only when needed, e.g. `-1.8`. It's visible proof the armor is working.

Examples: a Spider (5) does 4.25 through Leather Vest. Gnawfang (14) does 9.1 through Crystal Plate.

### 8.3 Plumbing

- `balance.js`: a new `ARMOR` table.
- `state.js`: `armors: []`, `armor: null`, and `blockParts(s)`. `sanitize()` fills these in for old saves.
- `economy.js`: a third `KINDS` entry, `armor: { items: ARMOR, owned: 'armors', equipped: 'armor', power: (it) => it.block }`. Buy, equip, auto-equip-if-better and `grantItem` all work unchanged.
- **HUD:** a new 🛡 chip showing the block %, after the ⚔ chip. It shows `0%` until armor is worn. It gets a new shield SVG in `ICON`, since the HUD avoids emoji.
- **Hero panel:** a "Defense" card (`blocks 25% · Iron Chainmail`) and an Armor section.
- **Model:** `catModel()` gets an `armorSlot` and a `setArmor(id)`, the same pattern as the helmet. Each armor is a shell slightly larger than the torso, with its own colours and details:
  - Sweater: knit stripes.
  - Leather Vest: straps.
  - Chainmail: grey with rivets.
  - Crystal Plate: glowing cyan.
  - Sunguard Armor: gold with a sun emblem.

### 8.4 Shop gets tabs

With 8 weapons, 4 helmets and 5 armors, one long list is too much on a phone. The shop gets tabs: **Training · Weapons · Helmets · Armor**.

- The last tab you used is remembered while the game is running.
- Locked items stay visible, showing a 🔒 and their unlock hint, because seeing what's next is the point of "to unlock".
- The Hero panel (equip what you own) stays a single list, since it only shows owned items.

## 9. Save data

The save key `herocat.save.v1` and `v: 1` stay the same. Every new field has a default, and `sanitize()` fills it in, so **existing saves keep all progress**. Gear already bought is kept at its old price.

New fields:
- `name` (string, default `'Pip'`)
- `armors` (array)
- `armor` (id or null)
- `helpSeen` (bool)

## 10. Code touched

```
index.html               name form markup and styles (title screen)
src/main.js              New Game → name form → game.start(true, name)
src/game.js              start(fresh, name); showHelp(); respawn queue; guide arrow update;
                         damageTaken; unlock toasts; armor in onGearChanged
src/game/balance.js      WEAPONS (+4, new prices, unlock ids), ARMOR, rat/bat stats + respawn
src/game/economy.js      UNLOCKS, armor kind, locked reason + hint
src/game/state.js        name/cleanName, armors/armor, helpSeen, blockParts, sanitize
src/game/combat.js       damageTaken()
src/game/story.js        {name} placeholders
src/game/enemies.js      spawn point + grow-in on respawn
src/game/respawn.js      NEW: respawn queue (pure)
src/game/guide.js        NEW: which goal to point at (pure)
src/engine/navgrid.js    NEW: grid from collision + flow field + next waypoint (pure)
src/engine/collision.js  overlaps(x, z, r) query
src/world/models.js      4 weapon models, armorSlot + 5 armor models, arrow model
src/world/village.js     goal positions (tower, cave mouths)
src/world/cave.js        goal positions (boss, exit, portal), level bounds for the grid
src/ui/dialogue.js       {name} substitution and speaker name
src/ui/hud.js            🛡 chip
src/ui/shop.js           tabs, armor section, lock hints, name in header, rename
src/ui/menu.js           help view (first-time mode, full controls), name in credits
src/ui/dom.js            escapeHtml, shield icon
src/ui/ui.css            name form, kbd keycaps, shop tabs, 🛡 chip
```

## 11. Tests

**Unit tests (Vitest):**

- `economy.test.js`:
  - new prices; the existing "buys the club" test changes from 100 g to 150 g;
  - every unlock rule locks until its condition is met (including the 75-kill counter);
  - armor buys, equips and auto-equips the better piece.
- `state.test.js`:
  - `cleanName` covers blank → Pip, whitespace, a 13+ character name, emoji, and `<b>` (kept as text);
  - a v1.0 save without the new fields loads with defaults and keeps its progress.
- `combat.test.js`: `damageTaken` with 0%, 10% and 50% block.
- `respawn.test.js`: an entry fires after exactly 10 s of ticks; summoned enemies are never queued.
- `navgrid.test.js`: on a small U-shaped test map, the next waypoint goes around the wall rather than through it; multi-source goals pick the nearer one.
- `guide.test.js`: the goal for every row of the §6.2 table.
- `story.test.js`: no hard-coded "Pip" left in `SCRIPTS`; `{name}` is filled in.

**E2E (Playwright, desktop + Pixel 7):**

- New Game → type "Mochi" → the prologue mentions Mochi → Skip → the How to play screen shows → "Let's go!" closes it.
- The HUD shows `10 / 10`, `6`, and the 🛡 chip shows `0%`.
- The Hero panel header reads "Mochi the HeroCat".
- After a reload, Continue doesn't show the help again.

## 12. Performance check (CLAUDE.md spec)

- **Entry chunk:** the name form adds about 1 KB.
- **Game chunk:** about 6–9 KB more (models, nav grid, help text). The total stays well under the 200 KB budget (currently 166 KB). `npm run size` will confirm.
- **No new textures, models, fonts or shader programs.** The arrow and armor use the existing materials.
- **Runtime cost:**
  - +1 draw call for the arrow, plus one mesh per worn armor piece;
  - the flow field is rebuilt only when the goal changes;
  - respawning never exceeds the cave's original enemy count.
- After the change, re-measure draw calls and triangles in the village and the caves, and re-run the Slow 4G + 4× CPU load check from `next_0.md`.

## 13. Implementation order

1. Balance and economy: weapons, prices, unlock rules, armor, rat/bat stats. Then tests.
2. State: name, armor, `helpSeen`, sanitize. Then tests.
3. Armor in combat (`damageTaken`), the HUD 🛡 chip and the Hero panel.
4. Models: 4 weapons and 5 armors on the cat.
5. Shop tabs, lock hints and unlock toasts.
6. Name entry, `{name}` in all text, and rename.
7. How to play screen at the start.
8. Respawning rats and bats.
9. Nav grid and guide arrow.
10. E2E updates, size and performance checks, and a full playthrough (desktop and emulated phone). Then write `ai/next_1.md`.

## 14. Assumptions and open questions

Proceeding with these defaults unless told otherwise:

1. **Armor blocks a % of damage** in a new body slot. The alternative is armor that adds max HP like helmets: simpler, but then armor and helmets do the same job.
2. **"Cost more"** means roughly 2–2.5× for the existing weapons (Club 150, Claw-Blade 750). Helmet prices and training costs (50…2500 from prompt 0) are unchanged.
3. **Only rats and bats respawn.** Slimes, spiders, golems and Rat Guards don't, although any of them can be switched on with one field. Respawning only happens while you stay in the cave.
4. **Harder rats and bats** means more HP, rats hitting for 2, and slightly faster attacks. Their gold drops and the Big Rat Brute are unchanged.
5. **The arrow follows the main story only.** It doesn't point at chests or the trapped smith, and it's hidden after the game is won. No on/off setting for now; one can be added to the pause menu if it feels intrusive.
6. **Names** are up to 12 characters and default to "Pip". Existing saves start as "Pip" and can rename from the Hero panel. The hero's look doesn't change with the name.
7. **How to play** is shown once per save, after the prologue. It shows the controls for the device in use (keyboard/mouse or touch), not both.
