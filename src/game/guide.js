import { carryingGem } from './story.js';

/**
 * Where the golden guide arrow points: always the next step of the main story.
 * level: { kind: 'village' } or { kind: 'cave', index }.
 * Returns goal ids the level knows positions for (nearest one wins), or [] for "nowhere".
 */
export function guideGoals(s, level) {
  if (level.kind === 'village') {
    if (carryingGem(s)) return ['tower'];
    if (s.gemsPlaced < 3) return [`cave${s.gemsPlaced}`];
    return [];
  }
  // The boss is still here: go get the Sun Gem.
  if (s.gemsFound <= level.index) return ['boss'];
  // Gem found (now or earlier): the way out, either the exit or the boss portal.
  return ['exit', 'portal'];
}
