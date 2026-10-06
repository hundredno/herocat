import { Mesh, RingGeometry } from 'three';
import { disposeModel, swingMat } from '../engine/materials.js';
import { CAT_LOOKS, catModel } from '../world/models.js';
import { PLAYER } from './balance.js';
import { angleDiff, angleTo } from './combat.js';

const HALF_ARC = PLAYER.attackHalfArc;

export class Player {
  constructor() {
    this.cat = catModel(CAT_LOOKS.pip);
    this.root = this.cat.root;
    this.radius = PLAYER.radius;
    this.x = 0;
    this.z = 0;
    this.vx = 0;
    this.vz = 0;
    this.facing = Math.PI;
    this.targetFacing = Math.PI;
    this.hp = 10;
    this.cooldown = 0;
    this.swing = -1;
    this.hitDone = true;
    this.hitNow = false;
    this.iframes = 0;
    this.dead = false;
    this.deadTime = 0;
    this.held = null;

    // white slash arc shown during a swing (+z is forward; ring angle -PI/2 maps to +z after laying it flat)
    const arc = new RingGeometry(0.55, PLAYER.attackRange + 0.2, 14, 1, -Math.PI / 2 - HALF_ARC, HALF_ARC * 2);
    arc.rotateX(-Math.PI / 2);
    this.arc = new Mesh(arc, swingMat());
    this.arc.position.y = 0.55;
    this.root.add(this.arc);
  }

  equip(weapon, helmet, armor) {
    this.cat.setWeapon(weapon);
    this.cat.setHelmet(helmet);
    this.cat.setArmor(armor);
  }

  place(x, z, facing = Math.PI) {
    this.x = x;
    this.z = z;
    this.vx = this.vz = 0;
    this.facing = this.targetFacing = facing;
    this.swing = -1;
    this.cooldown = 0;
    this.sync();
  }

  revive(hp) {
    this.hp = hp;
    this.dead = false;
    this.deadTime = 0;
    this.iframes = 0;
    this.cat.body.rotation.set(0, 0, 0);
    this.root.visible = true;
  }

  update(dt, input, game) {
    this.hitNow = false;
    this.cooldown -= dt;
    this.iframes -= dt;
    if (this.dead) {
      this.deadTime += dt;
      return;
    }

    const mx = input.move.x;
    const mz = input.move.z;
    const k = 1 - Math.exp(-dt * 14);
    this.vx += (mx * PLAYER.speed - this.vx) * k;
    this.vz += (mz * PLAYER.speed - this.vz) * k;
    const slow = this.swing >= 0 ? 0.45 : 1;
    this.x += this.vx * dt * slow;
    this.z += this.vz * dt * slow;
    if (mx * mx + mz * mz > 0.02 && this.swing < 0) this.targetFacing = Math.atan2(mx, mz);
    this.facing += angleDiff(this.facing, this.targetFacing) * (1 - Math.exp(-dt * 16));

    if (input.attackHeld && this.cooldown <= 0) {
      const target = game.nearestEnemy(this.x, this.z, PLAYER.autoAimRange);
      if (target) this.facing = this.targetFacing = angleTo(this.x, this.z, target.x, target.z);
      this.swing = 0;
      this.hitDone = false;
      this.cooldown = PLAYER.attackCooldown;
    }
    if (this.swing >= 0) {
      this.swing += dt;
      if (!this.hitDone && this.swing >= PLAYER.hitTime) {
        this.hitDone = true;
        this.hitNow = true;
      }
      if (this.swing >= PLAYER.swingTime) this.swing = -1;
    }
  }

  /** Copy simulation state to the 3D model. */
  animate(dt, t) {
    this.sync();
    const cat = this.cat;
    const speed = Math.min(1, Math.hypot(this.vx, this.vz) / PLAYER.speed);
    if (this.dead) {
      cat.body.rotation.z = Math.min(Math.PI / 2, this.deadTime * 6);
      cat.update(dt, t, 0);
      return;
    }
    cat.update(dt, t, this.swing >= 0 ? 0 : speed);

    const arm = cat.arm;
    if (this.swing >= 0) {
      const p = Math.min(1, this.swing / (PLAYER.swingTime * 0.7));
      const e = 1 - (1 - p) * (1 - p);
      arm.rotation.set(-0.1, -1.6 + e * 3.2, 0);
      this.arc.material.opacity = 0.55 * (1 - this.swing / PLAYER.swingTime);
      this.arc.visible = true;
    } else {
      arm.rotation.x += (-0.9 - arm.rotation.x) * 0.2;
      arm.rotation.y += (-0.35 - arm.rotation.y) * 0.2;
      this.arc.visible = false;
    }
    this.root.visible = this.iframes <= 0 || Math.floor(this.iframes * 12) % 2 === 0;

    if (this.held) {
      this.held.position.set(0, 2.4 + Math.sin(t * 3) * 0.08, 0);
      this.held.rotation.y = t * 2;
    }
  }

  sync() {
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.facing;
  }

  /** Hold something over our head (Sun Gem moment). */
  hold(obj) {
    if (this.held) {
      this.root.remove(this.held);
      disposeModel(this.held);
    }
    this.held = obj;
    if (obj) this.root.add(obj);
  }
}
