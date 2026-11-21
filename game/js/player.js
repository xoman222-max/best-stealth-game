// Player: the courier. Walks, sneaks, and tosses coin decoys.
// Movement is axis-separated so the player slides along walls.

import { TILE, isSolid, tileAt } from './levels.js';

const WALK_SPEED = 152;
const SNEAK_SPEED = 78;
const RADIUS = 11;

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = RADIUS;
    this.facing = 0;
    this.sneaking = false;
    this.moving = false;
    this.decoys = 0;
    this.stepTimer = 0;
  }

  reset(x, y, decoys) {
    this.x = x;
    this.y = y;
    this.facing = 0;
    this.sneaking = false;
    this.moving = false;
    this.decoys = decoys;
    this.stepTimer = 0;
  }

  update(dt, input, level, events) {
    let mx = 0;
    let my = 0;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    if (input.up) my -= 1;
    if (input.down) my += 1;
    this.moving = mx !== 0 || my !== 0;
    this.sneaking = !!input.sneak;

    if (this.moving) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      this.facing = Math.atan2(my, mx);
      const speed = this.sneaking ? SNEAK_SPEED : WALK_SPEED;
      const nx = this.x + mx * speed * dt;
      const ny = this.y + my * speed * dt;
      if (!this.hitsSolid(nx, this.y, level)) this.x = nx;
      if (!this.hitsSolid(this.x, ny, level)) this.y = ny;

      // Footsteps make noise: walking is loud, sneaking is quiet.
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.sneaking ? 0.55 : 0.36;
        events.onFootstep(this.x, this.y, this.sneaking ? 26 : 72, this.sneaking);
      }
    }
  }

  hitsSolid(px, py, level) {
    const r = this.radius - 2;
    const corners = [
      [px - r, py - r], [px + r, py - r],
      [px - r, py + r], [px + r, py + r],
    ];
    return corners.some(([cx, cy]) => {
      const t = tileAt(level, cx, cy);
      return isSolid(level, t.tx, t.ty);
    });
  }

  // Throw a coin toward (tx, ty), clamped to throwing range. Returns the
  // landing point, or null when no coins are left.
  throwDecoy(tx, ty) {
    if (this.decoys <= 0) return null;
    const maxRange = 250;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    const range = Math.min(dist, maxRange);
    const angle = Math.atan2(dy, dx);
    this.decoys -= 1;
    return {
      x: this.x + Math.cos(angle) * range,
      y: this.y + Math.sin(angle) * range,
    };
  }
}
