import { Group, Mesh } from 'three';
import { Builder, model } from '../engine/builder.js';
import { disposeModel, getShadowMat, shadowGeo } from '../engine/materials.js';

// Procedural low-poly models. Characters face +z in local space; their right paw is at -x.

const PI = Math.PI;

export function blobShadow(size) {
  const m = new Mesh(shadowGeo, getShadowMat());
  m.scale.set(size, 1, size);
  m.position.y = 0.03;
  m.renderOrder = -1;
  return m;
}

const wave = (t, speed, amp, phase = 0) => Math.sin(t * speed + phase) * amp;

// ---------------------------------------------------------------- cats

export const CAT_LOOKS = {
  pip: { fur: 0xf39c34, belly: 0xffe3b8, stripe: 0xd2701a, scarf: 0xd63031 },
  elder: { fur: 0xa9a9b3, belly: 0xf1f1f1, stripe: 0x8a8a96, scarf: 0x6c5ce7, beard: true, staff: true },
  biscuit: { fur: 0xd9a066, belly: 0xfff1dc, stripe: null, apron: 0xffffff },
  smith: { fur: 0x7b5a43, belly: 0xc9a88c, stripe: 0x5e4332, apron: 0x4a3426 },
  tom: { fur: 0x2f2f35, belly: 0x5b5b66, stripe: null, scarf: 0x0984e3 },
  luna: { fur: 0xf4f4f4, belly: 0xffffff, stripe: null, bow: 0xfd79a8 },
};

export function catModel(look = CAT_LOOKS.pip) {
  const { fur, belly, stripe } = look;
  const root = new Group();
  const body = new Group();
  root.add(body, blobShadow(1.3));

  const b = new Builder();
  b.box(0.62, 0.44, 0.82, fur, { p: [0, 0.6, 0], grad: [0.82, 1.05] });
  b.box(0.5, 0.06, 0.64, belly, { p: [0, 0.37, 0.02] });
  if (stripe) for (const z of [-0.26, -0.02, 0.2]) b.box(0.64, 0.06, 0.1, stripe, { p: [0, 0.81, z] });
  // head
  b.box(0.62, 0.52, 0.52, fur, { p: [0, 1.02, 0.42], grad: [0.9, 1.05] });
  if (stripe) b.box(0.2, 0.04, 0.3, stripe, { p: [0, 1.29, 0.38] });
  b.box(0.36, 0.2, 0.08, belly, { p: [0, 0.89, 0.69] });
  b.box(0.09, 0.06, 0.04, 0xe8607a, { p: [0, 0.97, 0.735] });
  for (const s of [-1, 1]) {
    b.box(0.1, 0.15, 0.03, 0x1e1e24, { p: [s * 0.15, 1.08, 0.69] });
    b.box(0.04, 0.05, 0.02, 0xffffff, { p: [s * 0.13, 1.12, 0.705], glow: true });
    b.cone(0.14, 0.28, 4, fur, { p: [s * 0.2, 1.41, 0.4], r: [0, PI / 4, 0] });
    b.cone(0.08, 0.16, 4, 0xffb3c1, { p: [s * 0.2, 1.38, 0.47], r: [0, PI / 4, 0] });
    b.box(0.24, 0.015, 0.015, 0xffffff, { p: [s * 0.3, 0.9, 0.7], r: [0, 0, s * 0.12] });
  }
  if (look.scarf) {
    b.box(0.66, 0.12, 0.6, look.scarf, { p: [0, 0.8, 0.38] });
    b.box(0.13, 0.32, 0.06, look.scarf, { p: [0.22, 0.68, 0.06], r: [0.35, 0, 0.25] });
  }
  if (look.apron) b.box(0.52, 0.42, 0.04, look.apron, { p: [0, 0.6, 0.42] });
  if (look.beard) b.box(0.3, 0.22, 0.1, 0xffffff, { p: [0, 0.74, 0.68] });
  if (look.bow) {
    b.box(0.16, 0.12, 0.06, look.bow, { p: [-0.22, 1.32, 0.5], r: [0, 0, 0.5] });
    b.box(0.16, 0.12, 0.06, look.bow, { p: [-0.08, 1.32, 0.5], r: [0, 0, -0.5] });
  }
  body.add(b.build());

  // legs swing from the hip
  const legs = [];
  for (const [x, z] of [[-0.18, 0.26], [0.18, 0.26], [-0.18, -0.26], [0.18, -0.26]]) {
    const pivot = new Group();
    pivot.position.set(x, 0.42, z);
    pivot.add(
      model((lb) => {
        lb.box(0.16, 0.34, 0.16, fur, { p: [0, -0.17, 0] });
        lb.box(0.18, 0.08, 0.2, belly, { p: [0, -0.38, 0.02] });
      }),
    );
    body.add(pivot);
    legs.push(pivot);
  }

  const tail = new Group();
  tail.position.set(0, 0.72, -0.38);
  tail.add(
    model((tb) => {
      tb.cyl(0.06, 0.08, 0.5, 5, fur, { p: [0, 0.18, -0.14], r: [-0.6, 0, 0] });
      tb.cyl(0.05, 0.06, 0.32, 5, stripe ?? fur, { p: [0, 0.48, -0.24], r: [-0.25, 0, 0] });
    }),
  );
  body.add(tail);

  // right paw holds the weapon; a pivot at the shoulder lets it swing
  const arm = new Group();
  arm.position.set(-0.36, 0.66, 0.22);
  arm.add(model((ab) => ab.box(0.14, 0.14, 0.14, belly, { p: [0, 0, 0.08] })));
  const weaponSlot = new Group();
  weaponSlot.position.set(0, 0, 0.08);
  arm.add(weaponSlot);
  body.add(arm);

  if (look.staff) {
    arm.add(
      model((sb) => {
        sb.cyl(0.04, 0.04, 1.3, 5, 0x8b5a2b, { p: [0, 0.1, 0.1] });
        sb.ico(0.09, 0, 0xffd166, { p: [0, 0.78, 0.1], glow: true });
      }),
    );
  }

  const helmetSlot = new Group();
  helmetSlot.position.set(0, 1.28, 0.42);
  body.add(helmetSlot);
  const armorSlot = new Group();
  body.add(armorSlot);

  let walk = 0;
  return {
    root,
    body,
    arm,
    weaponSlot,
    helmetSlot,
    armorSlot,
    setWeapon(id) {
      if (weaponSlot.userData.id === id) return;
      weaponSlot.userData.id = id;
      disposeModel(weaponSlot);
      weaponSlot.clear();
      if (id) weaponSlot.add(weaponModel(id));
    },
    setHelmet(id) {
      if (helmetSlot.userData.id === id) return;
      helmetSlot.userData.id = id;
      disposeModel(helmetSlot);
      helmetSlot.clear();
      if (id) helmetSlot.add(helmetModel(id));
    },
    setArmor(id) {
      if (armorSlot.userData.id === id) return;
      armorSlot.userData.id = id;
      disposeModel(armorSlot);
      armorSlot.clear();
      if (id) armorSlot.add(armorModel(id));
    },
    /** move: 0..1 how fast we're walking. */
    update(dt, t, move) {
      walk += dt * 13 * move;
      for (let i = 0; i < 4; i++) legs[i].rotation.x = Math.sin(walk + (i === 0 || i === 3 ? 0 : PI)) * 0.75 * move;
      body.position.y = Math.abs(Math.sin(walk)) * 0.07 * move + wave(t, 2.2, 0.012);
      tail.rotation.x = -0.25 + wave(t, 3, 0.12);
      tail.rotation.z = wave(t, 2.1, 0.35);
    },
  };
}

export function weaponModel(id) {
  return model((b) => {
    switch (id) {
      case 'bamboo':
        b.cyl(0.05, 0.05, 0.22, 6, 0x8b5a2b, { p: [0, 0, 0.02], r: [PI / 2, 0, 0] });
        b.cyl(0.045, 0.05, 0.95, 6, 0x6ab04c, { p: [0, 0, 0.6], r: [PI / 2, 0, 0] });
        for (const z of [0.38, 0.66, 0.92]) b.cyl(0.058, 0.058, 0.04, 6, 0x9bd16a, { p: [0, 0, z], r: [PI / 2, 0, 0] });
        break;
      case 'club':
        b.cyl(0.05, 0.05, 0.25, 6, 0x5b3a1e, { p: [0, 0, 0.02], r: [PI / 2, 0, 0] });
        b.cyl(0.14, 0.06, 0.8, 7, 0x9c6b3c, { p: [0, 0, 0.55], r: [PI / 2, 0, 0], faceVary: 0.12 });
        b.box(0.05, 0.05, 0.05, 0x5b3a1e, { p: [0.12, 0.03, 0.75] });
        break;
      case 'claw':
        b.cyl(0.05, 0.05, 0.24, 6, 0x2d3436, { p: [0, 0, 0.02], r: [PI / 2, 0, 0] });
        b.box(0.32, 0.06, 0.08, 0xd4a017, { p: [0, 0, 0.16] });
        b.box(0.05, 0.14, 0.8, 0xc7ced4, { p: [0, 0, 0.58] });
        b.cone(0.07, 0.24, 4, 0xc7ced4, { p: [0, 0, 1.1], r: [PI / 2, 0, 0], s: [0.7, 1, 1.4] });
        break;
      case 'fishbone':
        b.cyl(0.04, 0.04, 0.95, 5, 0x8b5a2b, { p: [0, 0, 0.3], r: [PI / 2, 0, 0] });
        b.cyl(0.025, 0.025, 0.55, 4, 0xf5f0e1, { p: [0, 0, 1.0], r: [PI / 2, 0, 0] });
        for (let i = 0; i < 4; i++) b.box(0.3 - i * 0.05, 0.03, 0.03, 0xebe3cc, { p: [0, 0, 0.82 + i * 0.12] });
        b.cone(0.1, 0.24, 4, 0xf5f0e1, { p: [0, 0, 1.38], r: [PI / 2, 0, 0], s: [1.2, 1, 0.7] });
        b.box(0.03, 0.03, 0.03, 0x2d3436, { p: [0.05, 0.03, 1.3] });
        for (const x of [-1, 1]) b.box(0.1, 0.03, 0.14, 0xebe3cc, { p: [x * 0.07, 0, 0.74], r: [0, x * 0.6, 0] });
        break;
      case 'hammer':
        b.cyl(0.045, 0.045, 0.85, 6, 0x5b3a1e, { p: [0, 0, 0.33], r: [PI / 2, 0, 0] });
        b.box(0.42, 0.26, 0.26, 0x7f8c8d, { p: [0, 0, 0.82], faceVary: 0.08, grad: [0.85, 1.1] });
        b.box(0.43, 0.27, 0.07, 0xffe066, { p: [0, 0, 0.82], glow: true });
        b.box(0.08, 0.08, 0.08, 0xffe066, { p: [0, 0.17, 0.82], r: [0, PI / 4, 0], glow: true });
        break;
      case 'crystal':
        b.cyl(0.05, 0.05, 0.24, 6, 0x2d3436, { p: [0, 0, 0.02], r: [PI / 2, 0, 0] });
        b.box(0.34, 0.06, 0.08, 0x8e44ad, { p: [0, 0, 0.16] });
        b.box(0.07, 0.15, 0.95, 0x7ee8fa, { p: [0, 0, 0.68], glow: true });
        b.cone(0.08, 0.26, 4, 0x7ee8fa, { p: [0, 0, 1.28], r: [PI / 2, 0, 0], s: [0.75, 1, 1.4], glow: true });
        b.octa(0.05, 0xffffff, { p: [0, 0, 0.16], glow: true });
        break;
      case 'sunfire':
        b.cyl(0.05, 0.05, 0.26, 6, 0x6d4c41, { p: [0, 0, 0.02], r: [PI / 2, 0, 0] });
        b.box(0.44, 0.08, 0.1, 0xf1c40f, { p: [0, 0, 0.17] });
        b.octa(0.07, 0xff5e1a, { p: [0, 0, 0.17], glow: true });
        b.box(0.08, 0.17, 1.15, 0xffb142, { p: [0, 0, 0.8], glow: true });
        b.box(0.09, 0.05, 1.0, 0xfff3b0, { p: [0, 0, 0.78], glow: true });
        b.cone(0.09, 0.3, 4, 0xffb142, { p: [0, 0, 1.52], r: [PI / 2, 0, 0], s: [0.75, 1, 1.4], glow: true });
        break;
      case 'moonsteel':
        b.cyl(0.05, 0.05, 0.26, 6, 0x2c2c54, { p: [0, 0, 0.02], r: [PI / 2, 0, 0] });
        b.box(0.4, 0.07, 0.09, 0x8e44ad, { p: [0, 0, 0.17] });
        b.box(0.06, 0.16, 1.05, 0xcdeeff, { p: [0, 0, 0.72], glow: true });
        b.cone(0.08, 0.28, 4, 0xcdeeff, { p: [0, 0, 1.38], r: [PI / 2, 0, 0], s: [0.75, 1, 1.4], glow: true });
        break;
    }
  });
}

export function helmetModel(id) {
  return model((b) => {
    switch (id) {
      case 'leaf':
        b.sphere(0.3, 6, 3, 0x55a630, { p: [0, 0.04, -0.02], s: [1.1, 0.25, 1.3], r: [0.15, 0, 0] });
        b.cyl(0.025, 0.025, 0.18, 4, 0x2b6b1a, { p: [0, 0.12, 0.05] });
        break;
      case 'acorn':
        b.sphere(0.36, 8, 4, 0x8b5a2b, { p: [0, 0, 0], s: [1.02, 0.5, 0.9], faceVary: 0.1 });
        b.cyl(0.36, 0.37, 0.07, 8, 0x5e3a19, { p: [0, -0.02, 0] });
        b.cyl(0.035, 0.05, 0.16, 5, 0x5e3a19, { p: [0, 0.22, 0] });
        break;
      case 'iron':
        b.box(0.7, 0.22, 0.58, 0x9aa3ab, { p: [0, 0.06, 0], grad: [0.8, 1.1] });
        b.box(0.08, 0.18, 0.66, 0xc0392b, { p: [0, 0.24, -0.02] });
        b.box(0.08, 0.2, 0.05, 0x7f8c8d, { p: [0, -0.06, 0.3] });
        break;
      case 'crown':
        b.cyl(0.3, 0.28, 0.16, 8, 0xf1c40f, { p: [0, 0.06, 0] });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * PI * 2;
          b.cone(0.07, 0.18, 4, 0xf1c40f, { p: [Math.sin(a) * 0.25, 0.22, Math.cos(a) * 0.25] });
        }
        b.octa(0.06, 0xe84393, { p: [0, 0.08, 0.3], glow: true });
        break;
    }
  });
}

/** Body armor: a shell around the cat's torso (torso spans y 0.38..0.82, z -0.41..0.41). */
export function armorModel(id) {
  return model((b) => {
    const shell = (color, o = {}) => b.box(0.7, 0.42, 0.72, color, { p: [0, 0.63, -0.05], ...o });
    switch (id) {
      case 'sweater':
        shell(0x74b9ff, { grad: [0.85, 1.05] });
        for (const y of [0.52, 0.7]) b.box(0.72, 0.05, 0.74, 0xffffff, { p: [0, y, -0.05] });
        b.box(0.72, 0.08, 0.2, 0x0984e3, { p: [0, 0.78, 0.26] });
        break;
      case 'leather':
        shell(0x9c6b3c, { grad: [0.8, 1.05], faceVary: 0.05 });
        b.box(0.72, 0.07, 0.74, 0x4a2c14, { p: [0, 0.5, -0.05] });
        for (const x of [-0.17, 0.17]) b.box(0.08, 0.02, 0.74, 0x4a2c14, { p: [x, 0.85, -0.05] });
        b.box(0.1, 0.09, 0.03, 0xd4a017, { p: [0.36, 0.5, 0.05], r: [0, PI / 2, 0] });
        break;
      case 'chain':
        shell(0x9aa3ab, { faceVary: 0.18 });
        b.box(0.24, 0.03, 0.74, 0xc0392b, { p: [0, 0.85, -0.05] });
        for (const x of [-1, 1]) b.sphere(0.15, 6, 4, 0x7f8c8d, { p: [x * 0.34, 0.8, 0.16], s: [1, 0.7, 1] });
        break;
      case 'crystal':
        shell(0x48b5c9, { grad: [0.75, 1.1] });
        for (let i = 0; i < 3; i++) b.cone(0.08, 0.32 - i * 0.05, 4, 0x9ef0ff, { p: [0, 0.95, 0.08 - i * 0.2], r: [-0.3, 0, 0], glow: true });
        for (const x of [-1, 1]) b.octa(0.13, 0x9ef0ff, { p: [x * 0.36, 0.8, 0.16], glow: true });
        break;
      case 'sun':
        shell(0xf1c40f, { grad: [0.8, 1.1] });
        b.cyl(0.15, 0.15, 0.03, 10, 0xff9f1c, { p: [0, 0.85, -0.12], glow: true });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * PI * 2;
          b.box(0.05, 0.02, 0.1, 0xffe066, { p: [Math.sin(a) * 0.23, 0.85, -0.12 + Math.cos(a) * 0.23], r: [0, a, 0], glow: true });
        }
        for (const x of [-1, 1]) b.sphere(0.16, 7, 4, 0xf9d342, { p: [x * 0.35, 0.8, 0.16], s: [1, 0.7, 1] });
        break;
    }
  });
}

/** Flat golden double chevron lying on the ground, pointing along +z. */
export function arrowModel() {
  return model((b) => {
    for (const z of [0.25, -0.2]) {
      for (const x of [-1, 1]) {
        const o = { r: [0, -x * (PI / 4), 0] };
        b.box(0.34, 0.02, 0.78, 0x5a3300, { ...o, p: [x * 0.2, 0.08, z - 0.2], glow: true });
        b.box(0.2, 0.02, 0.62, z > 0 ? 0xffd35c : 0xffb84d, { ...o, p: [x * 0.2, 0.1, z - 0.2], glow: true });
      }
    }
  });
}

// ---------------------------------------------------------------- enemies

const RAT_LOOKS = {
  rat: { fur: 0x8e8e9a, belly: 0xc9c9d3, scale: 1 },
  ratGuard: { fur: 0x6d6d78, belly: 0xa9a9b5, scale: 1.2, helmet: true },
  brute: { fur: 0x8a6a4f, belly: 0xc2a688, scale: 1.9, collar: true },
  gnawfang: { fur: 0x5b5b68, belly: 0x9b9bab, scale: 2.4, crown: true, cape: 0xb03030 },
};

function ratModel(look) {
  const root = new Group();
  const body = new Group();
  body.scale.setScalar(look.scale);
  root.add(body, blobShadow(1.4 * look.scale));
  const b = new Builder();
  b.sphere(0.36, 7, 5, look.fur, { p: [0, 0.42, -0.05], s: [1, 0.85, 1.35], faceVary: 0.06 });
  b.sphere(0.25, 7, 5, look.fur, { p: [0, 0.54, 0.42], s: [0.9, 0.85, 1.05] });
  b.cone(0.16, 0.3, 6, look.belly, { p: [0, 0.5, 0.67], r: [PI / 2, 0, 0] });
  b.sphere(0.05, 5, 4, 0xff8fa3, { p: [0, 0.5, 0.83] });
  b.box(0.1, 0.07, 0.02, 0xffffff, { p: [0, 0.4, 0.72] });
  for (const s of [-1, 1]) {
    b.cyl(0.12, 0.12, 0.03, 8, 0xffb3c1, { p: [s * 0.17, 0.77, 0.38], r: [PI / 2, 0, 0] });
    b.box(0.07, 0.07, 0.03, 0xff3b30, { p: [s * 0.1, 0.61, 0.62], glow: true });
    b.box(0.12, 0.08, 0.16, 0xffb3c1, { p: [s * 0.18, 0.05, 0.25] });
    b.box(0.12, 0.08, 0.16, 0xffb3c1, { p: [s * 0.2, 0.05, -0.3] });
  }
  if (look.helmet) {
    b.sphere(0.27, 7, 3, 0x8395a7, { p: [0, 0.68, 0.38], s: [1, 0.6, 1] });
    b.box(0.32, 0.4, 0.06, 0x8b5a2b, { p: [0.36, 0.42, 0.12], r: [0, 0.4, 0] });
  }
  if (look.collar) {
    b.cyl(0.26, 0.26, 0.08, 8, 0x2d3436, { p: [0, 0.5, 0.24], r: [PI / 2.6, 0, 0] });
    for (const s of [-1, 0, 1]) b.cone(0.04, 0.12, 4, 0xdfe6e9, { p: [s * 0.16, 0.66, 0.2] });
  }
  if (look.crown) {
    b.cyl(0.15, 0.14, 0.12, 6, 0xf1c40f, { p: [0, 0.82, 0.4] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2;
      b.cone(0.04, 0.12, 4, 0xf1c40f, { p: [Math.sin(a) * 0.12, 0.93, 0.4 + Math.cos(a) * 0.12] });
    }
    b.octa(0.04, 0x00cec9, { p: [0, 0.83, 0.55], glow: true });
  }
  if (look.cape) b.box(0.62, 0.55, 0.06, look.cape, { p: [0, 0.48, -0.42], r: [-0.35, 0, 0] });
  body.add(b.build());

  const tail = new Group();
  tail.position.set(0, 0.35, -0.5);
  tail.add(model((tb) => tb.cyl(0.025, 0.05, 0.9, 4, 0xffb3c1, { p: [0, 0.02, -0.42], r: [PI / 2 + 0.25, 0, 0] })));
  body.add(tail);

  return {
    root,
    body,
    update(dt, t, info) {
      tail.rotation.y = wave(t, info.moving ? 14 : 4, 0.4);
      body.position.y = info.moving ? Math.abs(wave(t, 16, 0.06)) : 0;
      body.rotation.x = info.windup > 0 ? -0.35 * info.windup : info.lunge * 0.5;
    },
  };
}

function batModel() {
  const root = new Group();
  const body = new Group();
  body.position.y = 1.1;
  root.add(body, blobShadow(0.9));
  body.add(
    model((b) => {
      b.sphere(0.24, 6, 5, 0x4a3b5c, { faceVary: 0.08 });
      for (const s of [-1, 1]) {
        b.cone(0.07, 0.18, 4, 0x4a3b5c, { p: [s * 0.12, 0.26, 0.02] });
        b.box(0.06, 0.06, 0.03, 0xffd32a, { p: [s * 0.08, 0.05, 0.22], glow: true });
        b.cone(0.02, 0.07, 3, 0xffffff, { p: [s * 0.05, -0.09, 0.2], r: [PI, 0, 0] });
      }
    }),
  );
  const wings = [-1, 1].map((s) => {
    const pivot = new Group();
    pivot.position.set(s * 0.18, 0.02, 0);
    pivot.add(
      model((b) => {
        b.box(0.55, 0.03, 0.32, 0x6c5a80, { p: [s * 0.28, 0, -0.02] });
        b.box(0.3, 0.03, 0.2, 0x6c5a80, { p: [s * 0.62, -0.02, -0.06], r: [0, 0, s * -0.25] });
      }),
    );
    body.add(pivot);
    return pivot;
  });
  return {
    root,
    body,
    update(dt, t, info) {
      const flap = wave(t, info.windup > 0 ? 30 : 18, 0.7);
      wings[0].rotation.z = flap;
      wings[1].rotation.z = -flap;
      body.position.y = 1.1 + wave(t, 3, 0.12) - (info.lunge > 0 ? info.lunge * 1.5 : 0);
      body.rotation.x = info.windup > 0 ? -0.4 * info.windup : 0;
    },
  };
}

function slimeModel() {
  const root = new Group();
  const body = new Group();
  root.add(body, blobShadow(1.2));
  body.add(
    model((b) => {
      b.sphere(0.5, 8, 6, 0x6fcf4f, { p: [0, 0.36, 0], s: [1, 0.75, 1], faceVary: 0.06 });
      b.sphere(0.2, 5, 4, 0x4c9a35, { p: [0.12, 0.28, -0.05] });
      for (const s of [-1, 1]) b.box(0.08, 0.14, 0.03, 0x1e272e, { p: [s * 0.15, 0.48, 0.46] });
      b.box(0.08, 0.05, 0.02, 0xffffff, { p: [-0.25, 0.62, 0.38], glow: true });
    }),
  );
  return {
    root,
    body,
    update(dt, t, info) {
      const hop = info.moving ? Math.abs(Math.sin(t * 7)) : 0;
      body.position.y = hop * 0.35;
      const squash = info.windup > 0 ? 1 - 0.3 * info.windup : 1 + wave(t, 4, 0.05) + hop * 0.15;
      body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    },
  };
}

function spiderModel(queen) {
  const root = new Group();
  const body = new Group();
  const scale = queen ? 2.1 : 1;
  body.scale.setScalar(scale);
  root.add(body, blobShadow(1.6 * scale));
  const fur = queen ? 0x5b2c6f : 0x2e2a3a;
  body.add(
    model((b) => {
      b.sphere(0.38, 7, 5, fur, { p: [0, 0.52, -0.3], s: [1, 0.85, 1.15], faceVary: 0.07 });
      b.box(0.12, 0.03, 0.22, 0xe74c3c, { p: [0, 0.84, -0.32] });
      b.sphere(0.24, 6, 5, fur, { p: [0, 0.48, 0.2] });
      for (const [x, y] of [[-0.08, 0.56], [0.08, 0.56], [-0.15, 0.5], [0.15, 0.5]]) {
        b.box(0.05, 0.05, 0.03, 0xff3b30, { p: [x, y, 0.42], glow: true });
      }
      for (const s of [-1, 1]) b.cone(0.03, 0.14, 4, 0xdfe6e9, { p: [s * 0.07, 0.34, 0.38], r: [PI, 0, 0] });
      if (queen) {
        b.cyl(0.13, 0.12, 0.1, 6, 0xf1c40f, { p: [0, 0.73, 0.2] });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * PI * 2;
          b.cone(0.035, 0.1, 4, 0xf1c40f, { p: [Math.sin(a) * 0.1, 0.82, 0.2 + Math.cos(a) * 0.1] });
        }
      }
    }),
  );
  const sides = [-1, 1].map((s) => {
    const g = new Group();
    g.position.set(s * 0.16, 0.5, 0.05);
    g.add(
      model((b) => {
        for (let i = 0; i < 4; i++) {
          const z = 0.18 - i * 0.14;
          const ang = (i - 1.5) * 0.35;
          b.box(0.48, 0.05, 0.05, 0x1e1b26, { p: [s * 0.22, 0.12, z], r: [0, ang * s, s * 0.6] });
          b.box(0.05, 0.6, 0.05, 0x1e1b26, { p: [s * 0.46, -0.16, z + ang * 0.2], r: [0, 0, s * 0.25] });
        }
      }),
    );
    body.add(g);
    return g;
  });
  return {
    root,
    body,
    update(dt, t, info) {
      const sp = info.moving ? 20 : 3;
      sides[0].rotation.y = wave(t, sp, 0.18);
      sides[1].rotation.y = wave(t, sp, 0.18, PI);
      body.position.y = info.moving ? Math.abs(wave(t, sp, 0.04)) : 0;
      body.rotation.x = info.windup > 0 ? -0.45 * info.windup : info.lunge * 0.4;
    },
  };
}

function golemModel() {
  const root = new Group();
  const body = new Group();
  root.add(body, blobShadow(2));
  const stone = 0x8a8f94;
  body.add(
    model((b) => {
      b.box(0.36, 0.6, 0.4, stone, { p: [-0.28, 0.3, 0], faceVary: 0.1 });
      b.box(0.36, 0.6, 0.4, stone, { p: [0.28, 0.3, 0], faceVary: 0.1 });
      b.box(1.1, 0.9, 0.75, stone, { p: [0, 1.05, 0], faceVary: 0.1, grad: [0.85, 1.05] });
      b.box(0.55, 0.42, 0.5, stone, { p: [0, 1.72, 0.08], faceVary: 0.1 });
      b.box(0.5, 0.14, 0.5, 0x6ab04c, { p: [0.15, 1.53, -0.05] });
      b.box(0.4, 0.1, 0.3, 0x6ab04c, { p: [-0.3, 0.62, 0.2] });
      for (const s of [-1, 1]) b.box(0.1, 0.07, 0.03, 0xffd32a, { p: [s * 0.13, 1.76, 0.34], glow: true });
      b.box(0.3, 0.3, 0.03, 0x00cec9, { p: [0, 1.1, 0.38], glow: true, r: [0, 0, PI / 4], s: [0.6, 0.6, 1] });
    }),
  );
  const arms = [-1, 1].map((s) => {
    const g = new Group();
    g.position.set(s * 0.72, 1.35, 0);
    g.add(
      model((b) => {
        b.box(0.34, 0.8, 0.36, stone, { p: [0, -0.4, 0], faceVary: 0.1 });
        b.box(0.46, 0.4, 0.46, 0x7b8085, { p: [0, -0.92, 0.04], faceVary: 0.1 });
      }),
    );
    body.add(g);
    return g;
  });
  return {
    root,
    body,
    update(dt, t, info) {
      const raise = info.windup > 0 ? info.windup * -2.4 : info.lunge > 0 ? -2.4 + info.lunge * 4 : wave(t, 2, 0.08);
      arms[0].rotation.x = raise;
      arms[1].rotation.x = raise;
      body.position.y = info.moving ? Math.abs(wave(t, 6, 0.05)) : 0;
      body.rotation.z = info.moving ? wave(t, 6, 0.05) : 0;
    },
  };
}

export function enemyModel(type) {
  switch (type) {
    case 'bat':
      return batModel();
    case 'slime':
      return slimeModel();
    case 'spider':
      return spiderModel(false);
    case 'queen':
      return spiderModel(true);
    case 'golem':
      return golemModel();
    default:
      return ratModel(RAT_LOOKS[type]);
  }
}

// ---------------------------------------------------------------- props

export function addTree(b, x, z, s = 1, kind = 0) {
  b.cyl(0.18 * s, 0.26 * s, 1.2 * s, 6, 0x8b5a2b, { p: [x, 0.6 * s, z] });
  if (kind === 0) {
    b.cone(1.3 * s, 1.8 * s, 7, 0x3f8f3a, { p: [x, 1.9 * s, z], faceVary: 0.08 });
    b.cone(1.0 * s, 1.5 * s, 7, 0x4caf50, { p: [x, 2.7 * s, z], faceVary: 0.08 });
    b.cone(0.65 * s, 1.1 * s, 7, 0x5cc760, { p: [x, 3.4 * s, z], faceVary: 0.08 });
  } else {
    b.ico(1.25 * s, 0, 0x55a64a, { p: [x, 2.1 * s, z], faceVary: 0.1 });
    b.ico(0.8 * s, 0, 0x66bb55, { p: [x + 0.5 * s, 2.7 * s, z + 0.3 * s], faceVary: 0.1 });
  }
}

export function addRock(b, x, z, s = 1, color = 0x95a5a6) {
  b.dodec(0.6 * s, color, { p: [x, 0.25 * s, z], s: [1.2, 0.75, 1], r: [0.3, x * 7, 0.2], faceVary: 0.12 });
}

export function addHouse(b, x, z, rotY, wall, roof) {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const P = (lx, y, lz) => {
    const [wx, wz] = at(lx, lz);
    return [wx, y, wz];
  };
  b.box(4, 2.6, 3.6, wall, { p: P(0, 1.3, 0), r: [0, rotY, 0], grad: [0.8, 1.05] });
  b.box(4.2, 0.25, 3.8, 0x8d6e63, { p: P(0, 0.12, 0), r: [0, rotY, 0] });
  // triangular prism roof
  b.cyl(1, 1, 4.6, 3, roof, { p: P(0, 3.15, 0), r: [-PI / 2, rotY, PI / 2], order: 'YXZ', s: [2.45, 1, 1.1], faceVary: 0.05 });
  b.box(0.45, 1.1, 0.45, 0x7f6a5a, { p: P(1.1, 3.6, -0.6), r: [0, rotY, 0] });
  b.box(0.9, 1.5, 0.08, 0x6d4c41, { p: P(0, 0.85, 1.82), r: [0, rotY, 0] });
  b.box(0.08, 0.08, 0.04, 0xf1c40f, { p: P(0.3, 0.85, 1.86), r: [0, rotY, 0] });
  for (const lx of [-1.3, 1.3]) {
    b.box(0.7, 0.6, 0.06, 0xffe08a, { p: P(lx, 1.6, 1.81), r: [0, rotY, 0], glow: true });
    b.box(0.82, 0.08, 0.1, 0xffffff, { p: P(lx, 1.28, 1.84), r: [0, rotY, 0] });
  }
}

export function addFlower(b, x, z, color) {
  b.box(0.04, 0.3, 0.04, 0x2e8b3a, { p: [x, 0.15, z] });
  b.box(0.16, 0.12, 0.16, color, { p: [x, 0.32, z], r: [0, x, 0] });
  b.box(0.06, 0.06, 0.06, 0xfff3a0, { p: [x, 0.39, z] });
}

export function chestModel() {
  const root = new Group();
  root.add(
    blobShadow(1.4),
    model((b) => {
      b.box(0.9, 0.5, 0.6, 0x9c6b3c, { p: [0, 0.25, 0], faceVary: 0.05 });
      b.box(0.94, 0.08, 0.64, 0xd4a017, { p: [0, 0.12, 0] });
      b.box(0.94, 0.08, 0.64, 0xd4a017, { p: [0, 0.42, 0] });
    }),
  );
  const lid = new Group();
  lid.position.set(0, 0.5, -0.3);
  lid.add(
    model((b) => {
      b.box(0.9, 0.24, 0.6, 0xa87545, { p: [0, 0.12, 0.3] });
      b.box(0.94, 0.06, 0.64, 0xd4a017, { p: [0, 0.2, 0.3] });
      b.box(0.14, 0.16, 0.06, 0xf1c40f, { p: [0, 0.02, 0.62], glow: true });
    }),
  );
  root.add(lid);
  return { root, lid };
}

export function gemModel(color, size = 0.3) {
  return model((b) => {
    b.octa(size, color, { s: [1, 1.5, 1], glow: true });
    b.octa(size * 0.55, 0xffffff, { s: [1, 1.5, 1], glow: true, p: [0, 0, 0] });
  });
}

export function portalModel(color = 0x74b9ff) {
  const root = new Group();
  root.add(
    model((b) => {
      b.cyl(1.05, 1.05, 0.06, 20, color, { p: [0, 0.04, 0], glow: true });
      b.cyl(0.82, 0.82, 0.08, 20, color, { p: [0, 0.05, 0], glow: true, s: [1, 1, 1], grad: [0.5, 0.5] });
    }),
  );
  const spin = new Group();
  spin.add(
    model((b) => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2;
        b.box(0.14, 0.14, 0.14, color, { p: [Math.sin(a) * 0.95, 0.5 + (i % 2) * 0.6, Math.cos(a) * 0.95], r: [a, a, 0], glow: true });
      }
    }),
  );
  root.add(spin);
  return {
    root,
    update(dt, t) {
      spin.rotation.y = t * 1.5;
      spin.position.y = wave(t, 2, 0.15);
    },
  };
}
