import { Color, Group, Mesh, MeshBasicMaterial, SphereGeometry, Scene } from 'three';
import { Builder, mulberry32 } from '../engine/builder.js';
import { CollisionWorld } from '../engine/collision.js';
import { SUN_GEM_COLORS } from '../game/balance.js';
import { CAVES, LOCKED_HINTS, carryingGem, elderLines, isCaveUnlocked, villagerLines } from '../game/story.js';
import { setupLights } from './lighting.js';
import { CAT_LOOKS, addFlower, addHouse, addRock, addTree, catModel, gemModel } from './models.js';

export const CAVE_X = [-13, 0, 13];
const CLIFF_Z = -18;
const TOWER = [0, -3];
const FOUNTAIN = [-8, 4];
const SHOP = [8.5, 3.5];

// How the village looks with 0..3 Sun Gems returned: cold and dim → warm and bright.
const MOOD = [
  { bg: 0x52628a, sky: 0xaab8dc, ground: 0x44503e, hemi: 1.5, sun: 1.4, sunColor: 0xc4ceff, lantern: 0x56607a },
  { bg: 0x7392bd, sky: 0xc8d8f0, ground: 0x4a5a3a, hemi: 1.5, sun: 1.6, sunColor: 0xffe2b8, lantern: 0xffb36b },
  { bg: 0x8fbfe6, sky: 0xe0ecff, ground: 0x506040, hemi: 1.8, sun: 2.1, sunColor: 0xfff0d0, lantern: 0xffd27f },
  { bg: 0xa6dcff, sky: 0xffffff, ground: 0x5a6a45, hemi: 2.0, sun: 2.6, sunColor: 0xfff6e0, lantern: 0xfff3b0 },
];

export function createVillage() {
  const rng = mulberry32(7);
  const scene = new Scene();
  const collision = new CollisionWorld(4);
  const b = new Builder(rng);

  // ground, plaza, paths
  b.quad(110, 110, 0x7cc35a, { p: [0, 0, -5], faceVary: 0.05 }, 30);
  const path = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    b.box(2.2, 0.04, len, 0xd8b98a, { p: [(x1 + x2) / 2, 0.02, (z1 + z2) / 2], r: [0, Math.atan2(x2 - x1, z2 - z1), 0] });
    b.cyl(1.1, 1.1, 0.04, 8, 0xd8b98a, { p: [x2, 0.021, z2] });
  };
  path(0, 14, 0, 1);
  path(-3, -6, CAVE_X[0], -16.5);
  path(0, -7, CAVE_X[1], -16.5);
  path(3, -6, CAVE_X[2], -16.5);
  path(-3.5, 0, FOUNTAIN[0] + 1.5, FOUNTAIN[1] - 1.5);
  path(3.5, 0, SHOP[0] - 0.5, SHOP[1] + 3);
  b.cyl(5, 5, 0.06, 10, 0xcfc6b4, { p: [TOWER[0], 0.03, TOWER[1]], faceVary: 0.05 });

  // Lantern Tower
  const [tx, tz] = TOWER;
  b.cyl(1.6, 1.85, 0.7, 8, 0xb8b0a0, { p: [tx, 0.35, tz], faceVary: 0.06 });
  b.cyl(0.8, 1.0, 4.0, 8, 0xe2dccd, { p: [tx, 2.7, tz], grad: [0.8, 1.05] });
  b.cyl(1.35, 1.1, 0.35, 8, 0xb8b0a0, { p: [tx, 4.85, tz] });
  for (const [dx, dz] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) b.box(0.16, 1.7, 0.16, 0x6d4c41, { p: [tx + dx, 5.85, tz + dz] });
  b.cone(1.7, 1.3, 8, 0xc0392b, { p: [tx, 7.35, tz], faceVary: 0.05 });
  b.cyl(0.08, 0.08, 0.6, 4, 0x6d4c41, { p: [tx, 8.2, tz] });
  const gemSpots = [-0.75, 0, 0.75].map((a) => [tx + Math.sin(a) * 1.15, tz + Math.cos(a) * 1.15]);
  for (const [gx, gz] of gemSpots) b.cyl(0.2, 0.16, 0.18, 6, 0x5d5d5d, { p: [gx, 5.1, gz] });
  collision.addCircle(tx, tz, 1.9);

  // Fountain
  const [fx, fz] = FOUNTAIN;
  b.cyl(2, 2.15, 0.6, 10, 0xb8b0a0, { p: [fx, 0.3, fz], faceVary: 0.06 });
  b.cyl(1.75, 1.75, 0.05, 10, 0x74c7f5, { p: [fx, 0.58, fz], glow: true });
  b.cyl(0.25, 0.32, 1.3, 6, 0xb8b0a0, { p: [fx, 1.2, fz] });
  b.cyl(0.85, 0.4, 0.3, 8, 0xb8b0a0, { p: [fx, 1.95, fz] });
  b.cyl(0.72, 0.72, 0.04, 8, 0xa8e2ff, { p: [fx, 2.1, fz], glow: true });
  collision.addCircle(fx, fz, 2.1);

  // Biscuit's shop stall
  const [sx, sz] = SHOP;
  b.box(4, 1, 1, 0xa0703c, { p: [sx, 0.5, sz + 1.1], faceVary: 0.06 });
  b.box(4.3, 0.12, 1.25, 0x7b4f2a, { p: [sx, 1.06, sz + 1.1] });
  b.box(4, 2.6, 0.3, 0x8d6e63, { p: [sx, 1.3, sz - 1.4], faceVary: 0.04 });
  for (const sy of [1.2, 2.0]) b.box(3.8, 0.08, 0.5, 0x6d4c41, { p: [sx, sy, sz - 1.1] });
  for (let i = 0; i < 7; i++) {
    const c = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6][i % 5];
    b.box(0.22, 0.32, 0.22, c, { p: [sx - 1.6 + i * 0.52, 1.4 + (i % 2) * 0.8, sz - 1.05] });
  }
  for (const [dx, dz] of [[-2, -1.4], [2, -1.4], [-2, 1.6], [2, 1.6]]) b.box(0.18, 3.1, 0.18, 0x6d4c41, { p: [sx + dx, 1.55, sz + dz] });
  for (let i = 0; i < 6; i++) {
    b.box(0.75, 0.08, 3.6, i % 2 ? 0xffffff : 0xe74c3c, { p: [sx - 1.875 + i * 0.75, 3.25, sz + 0.1], r: [0.18, 0, 0] });
  }
  b.box(0.7, 0.7, 0.7, 0xb07d4a, { p: [sx + 2.7, 0.35, sz + 1.6], faceVary: 0.08 });
  b.box(0.55, 0.55, 0.55, 0xb07d4a, { p: [sx + 2.75, 0.98, sz + 1.55], r: [0, 0.4, 0], faceVary: 0.08 });
  b.cyl(0.38, 0.38, 0.9, 8, 0x8b5a2b, { p: [sx - 2.7, 0.45, sz + 1.5] });
  collision.addBox(sx - 2.2, sz - 1.7, sx + 2.2, sz + 1.75);
  collision.addCircle(sx + 2.7, sz + 1.6, 0.55);
  collision.addCircle(sx - 2.7, sz + 1.5, 0.45);

  // Houses (door side faces the village center)
  const houses = [
    [-18, -6, Math.PI / 2, 0xf5e6c8, 0xc0392b],
    [-18, 5, Math.PI / 2, 0xf8d7a8, 0x2e86de],
    [18, -6, -Math.PI / 2, 0xe8f0e0, 0x27ae60],
    [18, 5, -Math.PI / 2, 0xf6d6d6, 0x8e44ad],
    // north corners, behind the hero, so they never block the camera
    [-19, -13, 0, 0xf0e2c0, 0xe67e22],
    [19, -13, 0, 0xe0e8f0, 0x16a085],
  ];
  for (const [hx, hz, rot, wall, roof] of houses) {
    addHouse(b, hx, hz, rot, wall, roof);
    const sideways = Math.abs(Math.sin(rot)) > 0.5;
    const hw = sideways ? 1.9 : 2.1;
    const hd = sideways ? 2.1 : 1.9;
    collision.addBox(hx - hw, hz - hd, hx + hw, hz + hd);
  }

  // Trees
  const trees = [
    [-24, -14], [-23, -9], [-24, -1], [-23, 9], [-24, 13], [24, -14], [23, -9], [24, -1], [23, 9], [24, 13],
    [-7, -15.5], [6.5, -15.5], [-20, 0], [20, 0.5],
    [-9, -10], [9, -10], [-16, 12.5], [16.5, 12.5], [-21.5, -4], [21.5, 9.5],
  ];
  trees.forEach(([x, z], i) => {
    const s = 0.85 + rng() * 0.4;
    addTree(b, x, z, s, i % 3 === 0 ? 1 : 0);
    collision.addCircle(x, z, 0.45 * s);
  });

  // Cliff with three cave mouths
  b.box(64, 8, 10, 0x8a7866, { p: [0, 4, CLIFF_Z - 5.6], faceVary: 0.06, grad: [0.75, 1.05] });
  b.box(64, 0.5, 10, 0x6aa84f, { p: [0, 8.2, CLIFF_Z - 5.6], faceVary: 0.08 });
  for (let x = -30; x <= 30; x += 2.6) {
    if (CAVE_X.some((cx) => Math.abs(cx - x) < 2.6)) continue;
    const s = 1.6 + rng() * 1.2;
    b.dodec(s, rng() < 0.5 ? 0x8d7b68 : 0x7d6b5a, { p: [x + rng(), s * 0.6, CLIFF_Z - 1.4 - rng() * 0.6], faceVary: 0.12, r: [rng(), rng(), rng()] });
  }
  const banner = [0xa0522d, 0x00a8cc, 0x8e44ad];
  CAVE_X.forEach((cx, i) => {
    b.box(3, 3.2, 0.4, 0x0b0806, { p: [cx, 1.6, CLIFF_Z - 0.45], glow: true });
    b.box(0.7, 3.8, 0.9, 0x6d5d4e, { p: [cx - 1.85, 1.9, CLIFF_Z - 0.3], faceVary: 0.1 });
    b.box(0.7, 3.8, 0.9, 0x6d5d4e, { p: [cx + 1.85, 1.9, CLIFF_Z - 0.3], faceVary: 0.1 });
    b.box(4.4, 0.8, 1, 0x6d5d4e, { p: [cx, 3.9, CLIFF_Z - 0.3], faceVary: 0.1 });
    b.box(1.4, 0.9, 0.08, banner[i], { p: [cx, 4.9, CLIFF_Z + 0.2] });
    for (const s of [-1, 1]) {
      b.box(0.14, 1.6, 0.14, 0x5b3a1e, { p: [cx + s * 2.6, 0.8, CLIFF_Z + 0.6] });
      b.cone(0.2, 0.45, 5, 0xff9f1c, { p: [cx + s * 2.6, 1.8, CLIFF_Z + 0.6], glow: true });
    }
    collision.addCircle(cx - 2.6, CLIFF_Z + 0.6, 0.25);
    collision.addCircle(cx + 2.6, CLIFF_Z + 0.6, 0.25);
  });

  // Fence along the south edge
  for (let x = -23; x <= 23; x += 2) b.box(0.18, 0.9, 0.18, 0xc19a6b, { p: [x, 0.45, 14] });
  for (const y of [0.35, 0.7]) b.box(46, 0.1, 0.08, 0xc19a6b, { p: [0, y, 14] });

  // Decoration
  for (let i = 0; i < 70; i++) {
    const x = -22 + rng() * 44;
    const z = -14 + rng() * 27;
    if (Math.abs(x) < 6 && z > -9 && z < 3) continue; // plaza
    if (Math.abs(x) < 1.8) continue; // main road
    addFlower(b, x, z, [0xff7675, 0xfdcb6e, 0xa29bfe, 0xffffff, 0xfd79a8][i % 5]);
  }
  for (let i = 0; i < 14; i++) {
    const x = -21 + rng() * 42;
    const z = -14 + rng() * 26;
    if (Math.abs(x) < 6 && z > -9 && z < 3) continue;
    if (Math.abs(x) < 2) continue;
    b.ico(0.5 + rng() * 0.3, 0, 0x4fa043, { p: [x, 0.35, z], s: [1.2, 0.8, 1], faceVary: 0.1 });
  }
  addRock(b, -4.5, 9, 0.8);
  for (const [x, z] of [[-5.5, 11], [5.5, 11], [-4, 12.5], [4.2, 12.6], [-12, 12], [12, 12]]) {
    b.ico(0.7, 0, 0x4fa043, { p: [x, 0.45, z], s: [1.3, 0.8, 1.1], faceVary: 0.1 });
  }
  addRock(b, 4, -11, 1);
  addRock(b, -17, -12, 1.2);
  for (const [lx, lz] of [[-1.8, 10], [1.8, 6], [-1.8, 2.5]]) {
    b.box(0.14, 2.2, 0.14, 0x4a4a4a, { p: [lx, 1.1, lz] });
    b.box(0.34, 0.34, 0.34, 0xffe08a, { p: [lx, 2.3, lz], glow: true });
    collision.addCircle(lx, lz, 0.2);
  }

  scene.add(b.build());

  // Bounds
  collision.addBox(-60, -60, -23, 60);
  collision.addBox(23, -60, 60, 60);
  collision.addBox(-60, 13.3, 60, 60);
  collision.addBox(-60, -60, 60, CLIFF_Z);

  const lights = setupLights(scene, { ...MOOD[0], bg: MOOD[0].bg });

  // Dynamic parts
  const lantern = new Mesh(new SphereGeometry(0.5, 10, 8), new MeshBasicMaterial({ color: MOOD[0].lantern }));
  lantern.position.set(tx, 5.75, tz);
  scene.add(lantern);
  const gems = SUN_GEM_COLORS.map((c, i) => {
    const g = gemModel(c, 0.2);
    g.position.set(gemSpots[i][0], 5.45, gemSpots[i][1]);
    g.visible = false;
    scene.add(g);
    return g;
  });

  const boulders = CAVE_X.map((cx, i) => {
    const bb = new Builder(rng);
    bb.dodec(1.7, 0x9a9184, { p: [0, 1.3, 0], faceVary: 0.1, r: [0.4, 0.2, 0.1] });
    bb.dodec(0.8, 0x8a8174, { p: [1.2, 0.5, 0.6], faceVary: 0.1 });
    const mesh = bb.build();
    mesh.position.set(cx, 0, CLIFF_Z + 0.9);
    scene.add(mesh);
    const collider = collision.addCircle(cx, CLIFF_Z + 0.9, 1.6);
    return { mesh, collider, index: i };
  });

  // Villagers
  const npc = (look, x, z, facing) => {
    const cat = catModel(look);
    cat.root.position.set(x, 0, z);
    cat.root.rotation.y = facing;
    scene.add(cat.root);
    return { cat, x, z, facing, rest: facing };
  };
  const elder = npc(CAT_LOOKS.elder, -3.6, 0.4, 0.5);
  const biscuit = npc(CAT_LOOKS.biscuit, sx - 0.9, sz - 0.3, 0);
  const smith = npc(CAT_LOOKS.smith, sx + 1.1, sz - 0.3, 0);
  smith.cat.setWeapon('claw');
  const tom = npc(CAT_LOOKS.tom, -14.5, 0, Math.PI / 2);
  const luna = npc(CAT_LOOKS.luna, 14.5, 0, -Math.PI / 2);
  const npcs = [elder, biscuit, smith, tom, luna];
  for (const n of [elder, tom, luna]) collision.addCircle(n.x, n.z, 0.6);

  const labels = [
    { text: 'Shop', x: sx, y: 4.3, z: sz + 1.6 },
    { text: 'Lantern Tower', x: tx, y: 9, z: tz },
    ...CAVES.map((c, i) => ({ text: c.name, x: CAVE_X[i], y: 6.2, z: CLIFF_Z + 0.5, cave: i })),
  ];

  const interactables = [
    { kind: 'talk', x: elder.x, z: elder.z, r: 2.3, label: 'Talk to Elder Mittens', action: (g) => g.say(elderLines(g.state)) },
    { kind: 'talk', x: sx, z: sz + 2.6, r: 2.3, label: "Visit Biscuit's shop", action: (g) => g.openShop() },
    { kind: 'talk', x: tx, z: tz, r: 3.4, label: 'Place the Sun Gem', when: (g) => carryingGem(g.state), action: (g) => g.placeGem() },
    { kind: 'talk', x: tom.x, z: tom.z, r: 2.3, label: 'Talk to Tom', action: (g) => g.say(villagerLines('tom', g.state)) },
    { kind: 'talk', x: luna.x, z: luna.z, r: 2.3, label: 'Talk to Luna', action: (g) => g.say(villagerLines('luna', g.state)) },
    { kind: 'zone', x: fx, z: fz, r: 3.2, action: (g) => g.healAtFountain() },
    ...CAVE_X.flatMap((cx, i) => [
      { kind: 'trigger', x: cx, z: CLIFF_Z + 0.5, r: 0.95, when: (g) => isCaveUnlocked(g.state, i), action: (g) => g.enterCave(i) },
      {
        kind: 'trigger',
        x: cx,
        z: CLIFF_Z + 2.2,
        r: 2.6,
        when: (g) => !isCaveUnlocked(g.state, i),
        action: (g) => {
          g.sound.play('deny');
          g.toast(LOCKED_HINTS[i]);
        },
      },
    ]),
  ];

  // Where the guide arrow can lead; r = how close counts as "there" (the arrow hides).
  const goals = {
    tower: { x: tx, z: tz, r: 3.6 },
    ...Object.fromEntries(CAVE_X.map((cx, i) => [`cave${i}`, { x: cx, z: CLIFF_Z + 0.5, r: 2.2 }])),
  };

  const bg = new Color();
  const mood = { level: 0, target: 0 };

  function applyMood(v) {
    const lo = MOOD[Math.floor(v)];
    const hi = MOOD[Math.min(3, Math.floor(v) + 1)];
    const f = v - Math.floor(v);
    const mix = (a, c) => bg.set(a).lerp(new Color(c), f);
    scene.background.copy(mix(lo.bg, hi.bg));
    scene.fog.color.copy(scene.background);
    lights.hemi.color.copy(mix(lo.sky, hi.sky));
    lights.hemi.groundColor.copy(mix(lo.ground, hi.ground));
    lights.hemi.intensity = lo.hemi + (hi.hemi - lo.hemi) * f;
    lights.sun.color.copy(mix(lo.sunColor, hi.sunColor));
    lights.sun.intensity = lo.sun + (hi.sun - lo.sun) * f;
    lantern.material.color.copy(mix(lo.lantern, hi.lantern));
  }

  return {
    id: 'village',
    kind: 'village',
    scene,
    collision,
    lights,
    fog: { start: 14, range: 50 },
    spawns: {
      start: [0, 9, Math.PI],
      fountain: [fx + 2.8, fz + 1.5, Math.PI],
      cave0: [CAVE_X[0], CLIFF_Z + 3.6, 0],
      cave1: [CAVE_X[1], CLIFF_Z + 3.6, 0],
      cave2: [CAVE_X[2], CLIFF_Z + 3.6, 0],
    },
    enemySpawns: [],
    labels,
    interactables,
    bounds: { minX: -23, minZ: CLIFF_Z, maxX: 23, maxZ: 13.5 },
    goal: (id) => goals[id] ?? null,
    titleCenter: [0, -2],
    /** Sync everything that depends on story progress. */
    refresh(state, instant = false) {
      mood.target = Math.min(3, state.gemsPlaced);
      if (instant) mood.level = mood.target;
      applyMood(mood.level);
      gems.forEach((g, i) => (g.visible = i < state.gemsPlaced));
      for (const bo of boulders) {
        const open = isCaveUnlocked(state, bo.index);
        bo.collider.enabled = !open;
        if (instant || open) bo.mesh.visible = !open;
      }
      smith.cat.root.visible = state.smithRescued;
      for (const l of labels) if (l.cave !== undefined) l.text = (isCaveUnlocked(state, l.cave) ? '' : '🔒 ') + CAVES[l.cave].name;
    },
    boulderPositions: CAVE_X.map((cx) => [cx, CLIFF_Z + 0.9]),
    onEnter(game) {
      this.refresh(game.state, true);
    },
    update(dt, t, game) {
      if (mood.level !== mood.target) {
        mood.level += Math.sign(mood.target - mood.level) * Math.min(Math.abs(mood.target - mood.level), dt * 0.5);
        applyMood(mood.level);
      }
      lantern.scale.setScalar(1 + Math.sin(t * 3) * 0.05 * (1 + mood.level));
      gems.forEach((g, i) => (g.rotation.y = t * 1.5 + i));
      const p = game.player;
      for (const n of npcs) {
        if (!n.cat.root.visible) continue;
        n.cat.update(dt, t, 0);
        const near = game.mode !== 'title' && Math.hypot(p.x - n.x, p.z - n.z) < 4.5;
        const want = near ? Math.atan2(p.x - n.x, p.z - n.z) : n.rest;
        let d = (want - n.facing) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        n.facing += d * Math.min(1, dt * 5);
        n.cat.root.rotation.y = n.facing;
      }
      if (game.particles && Math.random() < dt * 6) {
        game.particles.burst(fx, 2.2, fz, { count: 1, color: 0xbfe9ff, speed: 1.2, up: 2.5, life: 0.7, size: 0.1, gravity: 7 });
      }
    },
  };
}
