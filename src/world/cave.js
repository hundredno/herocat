import { Group, Scene } from 'three';
import { Builder, mulberry32 } from '../engine/builder.js';
import { CollisionWorld } from '../engine/collision.js';
import { setupLights } from './lighting.js';
import { CAT_LOOKS, addRock, catModel, chestModel, portalModel } from './models.js';

export const TILE = 2;

// Map legend
//   #  wall          .  floor        P  hero start    X  exit to village
//   B  boss          C  chest        S  trapped smith
//   r rat  b bat  s slime  p spider  g golem  G rat guard
//   o rock  * crystal  f brazier  m mushrooms  w web  l lava crack  (decoration)
const ENEMY_KEYS = { r: 'rat', b: 'bat', s: 'slime', p: 'spider', g: 'golem', G: 'ratGuard' };

export function parseMap(text) {
  const rows = text.split('\n').filter((r) => r.trim().length);
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const at = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? '#' : rows[j][i] || '#');
  return { w, h, at, isFloor: (i, j) => at(i, j) !== '#' };
}

export function buildCave(def) {
  const { palette: pal } = def;
  const rng = mulberry32(def.index * 977 + 13);
  const map = parseMap(def.map);
  const { w, h, at, isFloor } = map;
  const wx = (i) => (i - w / 2 + 0.5) * TILE;
  const wz = (j) => (j - h / 2 + 0.5) * TILE;

  const scene = new Scene();
  const collision = new CollisionWorld(4);
  const b = new Builder(rng);
  const enemySpawns = [];
  const labels = [];
  let start = [0, 0];
  let exit = [0, 0];
  let boss = null;
  let chestPos = null;
  let smithPos = null;

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const c = at(i, j);
      const x = wx(i);
      const z = wz(j);
      if (c === '#') {
        let nearFloor = false;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (isFloor(i + di, j + dj)) nearFloor = true;
        if (!nearFloor) continue;
        // Walls between the camera (south) and the floor are kept low so they never hide the hero.
        const low = isFloor(i, j - 1);
        const H = low ? 0.7 : 2.8 + rng() * 0.8;
        b.box(TILE, H, TILE, pal.wall, { p: [x, H / 2, z], grad: [0.45, 1], faceVary: 0.07 });
        b.box(TILE, 0.12, TILE, pal.wallTop, { p: [x, H + 0.06, z], faceVary: 0.08 });
        collision.addBox(x - TILE / 2, z - TILE / 2, x + TILE / 2, z + TILE / 2);
        continue;
      }
      b.quad(TILE, TILE, (i + j) % 2 ? pal.floor : pal.floor2, { p: [x, 0, z], faceVary: 0.05 });
      if (rng() < 0.18) b.dodec(0.12 + rng() * 0.12, pal.rock, { p: [x + rng() * 1.4 - 0.7, 0.04, z + rng() * 1.4 - 0.7], faceVary: 0.1 });

      switch (c) {
        case 'P':
          start = [x, z];
          break;
        case 'X':
          exit = [x, z];
          break;
        case 'B':
          boss = { type: def.boss, x, z };
          break;
        case 'C':
          chestPos = [x, z];
          collision.addCircle(x, z, 0.6);
          break;
        case 'S':
          smithPos = [x, z];
          break;
        case 'o':
          addRock(b, x, z, 1.5, pal.rock);
          collision.addCircle(x, z, 0.85);
          break;
        case '*':
          for (let k = 0; k < 3; k++) {
            const a = rng() * Math.PI * 2;
            const s = 0.6 + rng() * 0.6;
            b.cone(0.25 * s, 1.6 * s, 5, pal.crystal, { p: [x + Math.sin(a) * 0.3, 0.7 * s, z + Math.cos(a) * 0.3], r: [rng() * 0.5 - 0.25, a, rng() * 0.5 - 0.25], glow: true });
          }
          collision.addCircle(x, z, 0.7);
          break;
        case 'f':
          b.cyl(0.45, 0.25, 0.5, 7, 0x5d5d5d, { p: [x, 0.5, z] });
          b.cyl(0.12, 0.12, 0.5, 5, 0x3d3d3d, { p: [x, 0.15, z] });
          b.cone(0.35, 0.7, 5, 0xff9f1c, { p: [x, 1.05, z], glow: true });
          b.cone(0.2, 0.5, 5, 0xffe066, { p: [x, 1.0, z], glow: true });
          collision.addCircle(x, z, 0.5);
          break;
        case 'm':
          for (let k = 0; k < 3; k++) {
            const mx = x + rng() * 1.2 - 0.6;
            const mz = z + rng() * 1.2 - 0.6;
            const s = 0.6 + rng() * 0.6;
            b.cyl(0.05 * s, 0.07 * s, 0.3 * s, 5, 0xf5f0e1, { p: [mx, 0.15 * s, mz] });
            b.sphere(0.18 * s, 6, 3, pal.mushroom, { p: [mx, 0.3 * s, mz], s: [1, 0.6, 1], glow: true });
          }
          break;
        case 'w':
          for (let k = 0; k < 4; k++) b.box(1.8, 0.02, 0.04, 0xe8e8f0, { p: [x, 0.03, z], r: [0, (k * Math.PI) / 4, 0], glow: true });
          b.cyl(0.5, 0.5, 0.02, 8, 0xe8e8f0, { p: [x, 0.025, z], s: [1, 1, 1] });
          break;
        case 'l':
          for (let k = 0; k < 3; k++) {
            b.box(1.2 + rng(), 0.02, 0.12, 0xff5e1a, { p: [x + rng() - 0.5, 0.02, z + rng() - 0.5], r: [0, rng() * Math.PI, 0], glow: true });
          }
          break;
        default:
          if (ENEMY_KEYS[c]) enemySpawns.push({ type: ENEMY_KEYS[c], x, z });
      }
    }
  }

  scene.add(b.build());
  const lights = setupLights(scene, pal.light);

  const exitPortal = portalModel(0xffeaa7);
  exitPortal.root.position.set(exit[0], 0, exit[1]);
  scene.add(exitPortal.root);
  labels.push({ text: 'Exit', x: exit[0], y: 2.2, z: exit[1] });

  const bossPortal = portalModel(0x74b9ff);
  if (boss) bossPortal.root.position.set(boss.x, 0, boss.z);
  scene.add(bossPortal.root);
  let portalOpen = false;

  const interactables = [
    { kind: 'trigger', x: exit[0], z: exit[1], r: 0.9, action: (g) => g.exitCave() },
    { kind: 'trigger', x: boss?.x ?? 0, z: boss?.z ?? 0, r: 1.1, when: () => portalOpen, action: (g) => g.exitCave() },
  ];

  let chest = null;
  if (chestPos) {
    chest = chestModel();
    chest.root.position.set(chestPos[0], 0, chestPos[1]);
    scene.add(chest.root);
    interactables.push({
      kind: 'trigger',
      x: chestPos[0],
      z: chestPos[1],
      r: 1.3,
      when: (g) => !g.state.chests[def.id],
      action: (g) => g.openChest(def),
    });
  }

  let smith = null;
  let smithCollider = null;
  if (smithPos) {
    smith = new Group();
    const cat = catModel(CAT_LOOKS.smith);
    smith.add(cat.root);
    const web = new Builder(rng);
    for (let k = 0; k < 7; k++) {
      web.box(1.1, 0.06, 0.06, 0xf5f6fa, { p: [0, 0.3 + k * 0.17, 0.05], r: [0, rng() * Math.PI, (rng() - 0.5) * 0.6], glow: true });
    }
    smith.add(web.build());
    smith.position.set(smithPos[0], 0, smithPos[1]);
    smith.userData.cat = cat;
    scene.add(smith);
    smithCollider = collision.addCircle(smithPos[0], smithPos[1], 0.6);
    interactables.push({
      kind: 'talk',
      x: smithPos[0],
      z: smithPos[1],
      r: 2.2,
      label: 'Free the trapped cat',
      when: (g) => !g.state.smithRescued,
      action: (g) => g.rescueSmith(),
    });
  }

  return {
    id: def.id,
    kind: 'cave',
    def,
    scene,
    collision,
    lights,
    fog: pal.fog,
    spawns: { start: [start[0], start[1], Math.PI] },
    enemySpawns,
    boss,
    labels,
    interactables,
    bounds: { minX: -(w * TILE) / 2, minZ: -(h * TILE) / 2, maxX: (w * TILE) / 2, maxZ: (h * TILE) / 2 },
    /** Where the guide arrow can lead; r = how close counts as "there". */
    goal(id) {
      if (id === 'boss' && boss) return { x: boss.x, z: boss.z, r: 5 };
      if (id === 'exit') return { x: exit[0], z: exit[1], r: 1.6 };
      if (id === 'portal' && boss && portalOpen) return { x: boss.x, z: boss.z, r: 1.6 };
      return null;
    },
    onEnter(game) {
      const s = game.state;
      if (chest) chest.lid.rotation.x = s.chests[def.id] ? -1.9 : 0;
      if (smith) {
        smith.visible = !s.smithRescued;
        smithCollider.enabled = !s.smithRescued;
      }
      portalOpen = bossPortal.root.visible = s.gemsFound > def.index;
    },
    openChestLid() {
      if (chest) chest.lid.rotation.x = -1.9;
    },
    showBossPortal() {
      portalOpen = bossPortal.root.visible = true;
    },
    hideSmith() {
      smith.visible = false;
      smithCollider.enabled = false;
    },
    update(dt, t, game) {
      exitPortal.update(dt, t);
      if (bossPortal.root.visible) bossPortal.update(dt, t);
      if (smith?.visible) smith.userData.cat.update(dt, t, 0);
      lights.lamp.position.set(game.player.x, 4.5, game.player.z + 1);
    },
  };
}
