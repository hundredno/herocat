import { Group, Mesh } from 'three';
import { discGeo, disposeModel, flashMat, litMat, warnInnerMat, warnOuterMat, windupMat } from '../engine/materials.js';
import { enemyModel } from '../world/models.js';
import { ENEMIES } from './balance.js';
import { angleDiff, angleTo } from './combat.js';

const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Enemy AI: idle (wander) → chase → windup (red circle fills) → strike → recover → chase…
 * Walk out of the red circle before it fills to dodge.
 */
export class Enemy {
  constructor(type, x, z) {
    const def = ENEMIES[type];
    this.type = type;
    this.def = def;
    this.boss = !!def.boss;
    this.hp = this.maxHp = def.hp;
    this.radius = def.radius;
    this.x = this.homeX = x;
    this.z = this.homeZ = z;
    this.kx = this.kz = 0; // knockback velocity
    this.facing = rand(0, Math.PI * 2);
    this.state = 'idle';
    this.timer = rand(0.3, 2);
    this.wanderX = x;
    this.wanderZ = z;
    this.flash = 0;
    this.lunge = 0;
    this.dead = false;
    this.gone = false;
    this.deadTime = 0;
    this.summonsLeft = def.summon ? [...def.summon.at] : [];
    this.speedMul = 1;

    this.model = enemyModel(type);
    this.root = new Group();
    this.root.add(this.model.root);
    this.warnOuter = new Mesh(discGeo, warnOuterMat);
    this.warnInner = new Mesh(discGeo, warnInnerMat);
    for (const m of [this.warnOuter, this.warnInner]) {
      m.position.y = 0.05;
      m.visible = false;
      m.renderOrder = 1;
      this.root.add(m);
    }
    this.warnOuter.scale.setScalar(def.reach);
    this.meshes = [];
    this.model.root.traverse((o) => o.isMesh && o.material === litMat && this.meshes.push(o));
    this.look = 'normal';
    this.info = { moving: false, windup: 0, lunge: 0 };
    this.sync();
  }

  get alive() {
    return !this.dead;
  }

  update(dt, game) {
    const def = this.def;
    const p = game.player;
    const dx = p.x - this.x;
    const dz = p.z - this.z;
    const dist = Math.hypot(dx, dz);
    this.timer -= dt;
    this.flash -= dt;
    this.lunge = Math.max(0, this.lunge - dt * 3);
    let tx = this.x;
    let tz = this.z;
    let speed = 0;

    if (this.dead) {
      this.deadTime += dt;
      if (this.deadTime > 0.35) this.gone = true;
      return;
    }

    switch (this.state) {
      case 'idle':
        if (!p.dead && dist < def.aggro) {
          this.state = 'chase';
          game.onAggro(this);
          break;
        }
        if (this.timer <= 0) {
          const a = rand(0, Math.PI * 2);
          const r = rand(0, def.flying ? 2.5 : 1.8);
          this.wanderX = this.homeX + Math.sin(a) * r;
          this.wanderZ = this.homeZ + Math.cos(a) * r;
          this.timer = rand(1.5, 3.5);
        }
        tx = this.wanderX;
        tz = this.wanderZ;
        speed = def.speed * 0.35;
        break;
      case 'chase': {
        const fromHome = Math.hypot(this.x - this.homeX, this.z - this.homeZ);
        if (p.dead || (!this.boss && (dist > def.aggro * 1.8 || fromHome > 16))) {
          this.state = 'return';
          break;
        }
        if (dist <= def.range + p.radius) {
          this.state = 'windup';
          this.timer = def.windup / this.speedMul;
          break;
        }
        tx = p.x;
        tz = p.z;
        speed = def.speed * this.speedMul;
        break;
      }
      case 'windup':
        // Track the player for the first part of the windup, then commit.
        if (this.timer > (def.windup / this.speedMul) * 0.4) this.facing += angleDiff(this.facing, angleTo(this.x, this.z, p.x, p.z)) * Math.min(1, dt * 10);
        if (this.timer <= 0) {
          if (!p.dead && dist <= def.reach + p.radius * 0.5) game.damagePlayer(def.dmg, this);
          if (this.boss) game.onBossSlam(this);
          this.lunge = 1;
          this.state = 'recover';
          this.timer = def.recover / this.speedMul;
        }
        break;
      case 'recover':
        if (this.timer <= 0) this.state = 'chase';
        break;
      case 'return': {
        if (!p.dead && dist < def.aggro * 0.8) {
          this.state = 'chase';
          break;
        }
        tx = this.homeX;
        tz = this.homeZ;
        speed = def.speed;
        if (Math.hypot(this.x - this.homeX, this.z - this.homeZ) < 0.5) {
          this.state = 'idle';
          this.hp = this.maxHp;
        }
        break;
      }
    }

    // steer
    const mx = tx - this.x;
    const mz = tz - this.z;
    const md = Math.hypot(mx, mz);
    this.info.moving = false;
    if (speed > 0 && md > 0.2) {
      const step = Math.min(md, speed * dt);
      this.x += (mx / md) * step;
      this.z += (mz / md) * step;
      this.facing += angleDiff(this.facing, Math.atan2(mx, mz)) * Math.min(1, dt * 8);
      this.info.moving = true;
    }
    this.x += this.kx * dt;
    this.z += this.kz * dt;
    const decay = Math.exp(-dt * 10);
    this.kx *= decay;
    this.kz *= decay;

    // boss tricks
    if (this.summonsLeft.length && this.hp / this.maxHp <= this.summonsLeft[0]) {
      this.summonsLeft.shift();
      game.summon(this, def.summon.type, def.summon.count);
    }
    if (def.enrageAt && this.speedMul === 1 && this.hp / this.maxHp <= def.enrageAt) {
      this.speedMul = 1.35;
      game.onEnrage(this);
    }
  }

  /** Returns true when this hit defeated the enemy. */
  hit(dmg, fromX, fromZ) {
    if (this.dead) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 0.12;
    if (!this.boss) {
      const d = Math.hypot(this.x - fromX, this.z - fromZ) || 1;
      this.kx = ((this.x - fromX) / d) * 7;
      this.kz = ((this.z - fromZ) / d) * 7;
    }
    if (this.state === 'idle' || this.state === 'return') this.state = 'chase';
    if (this.hp <= 0) {
      this.dead = true;
      this.state = 'dead';
      return true;
    }
    return false;
  }

  setLook(look) {
    if (look === this.look) return;
    this.look = look;
    const mat = look === 'flash' ? flashMat : look === 'windup' ? windupMat : litMat;
    for (const m of this.meshes) m.material = mat;
  }

  animate(dt, t) {
    this.sync();
    const windup = this.state === 'windup' ? 1 - Math.max(0, this.timer) / (this.def.windup / this.speedMul) : 0;
    this.info.windup = windup;
    this.info.lunge = this.lunge;
    this.model.update(dt, t, this.info);
    this.setLook(this.flash > 0 || this.dead ? 'flash' : windup > 0 ? 'windup' : 'normal');
    const warn = windup > 0;
    this.warnOuter.visible = this.warnInner.visible = warn;
    if (warn) this.warnInner.scale.setScalar(Math.max(0.05, windup) * this.def.reach);
    if (this.dead) {
      const s = Math.max(0.01, 1 - this.deadTime / 0.35);
      this.model.root.scale.set(1 + (1 - s) * 0.5, s, 1 + (1 - s) * 0.5);
    }
  }

  sync() {
    this.root.position.set(this.x, 0, this.z);
    this.model.root.rotation.y = this.facing;
  }

  dispose() {
    this.root.removeFromParent();
    disposeModel(this.model.root);
  }
}
