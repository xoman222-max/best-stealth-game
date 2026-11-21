// Guard: patrols waypoints, watches a vision cone, and reacts to what it
// sees and hears. Detection is recoverable: the meter drains when the player
// breaks line of sight, and an alerted guard gives up and goes back on patrol.

import { TILE, isSolid, tileAt } from './levels.js';

export const VISION_RANGE = 175;
export const VISION_HALF_ANGLE = 0.62; // ~35 degrees each side
export const CATCH_DIST = 22;

const PATROL_SPEED = 55;
const INVESTIGATE_SPEED = 88;
const CHASE_SPEED = 132;
const RETURN_SPEED = 70;

// Segment vs axis-aligned rectangle (Liang-Barsky). True when they touch.
export function segmentHitsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - rx, rx + rw - x1, y1 - ry, ry + rh - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

// Does any solid tile block the segment from (x1,y1) to (x2,y2)?
export function hasLineOfSight(level, x1, y1, x2, y2) {
  const minTx = Math.max(0, Math.floor(Math.min(x1, x2) / TILE) - 1);
  const maxTx = Math.min(29, Math.floor(Math.max(x1, x2) / TILE) + 1);
  const minTy = Math.max(0, Math.floor(Math.min(y1, y2) / TILE) - 1);
  const maxTy = Math.min(19, Math.floor(Math.max(y1, y2) / TILE) + 1);
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isSolid(level, tx, ty)) continue;
      if (segmentHitsRect(x1, y1, x2, y2, tx * TILE, ty * TILE, TILE, TILE)) return false;
    }
  }
  return true;
}

// Distance from a ray origin along direction (dx,dy) to the nearest solid
// tile edge, capped at maxDist. Slab test against each nearby tile AABB.
function rayDistance(level, ox, oy, dx, dy, maxDist) {
  let best = maxDist;
  const minTx = Math.max(0, Math.floor((ox - maxDist) / TILE));
  const maxTx = Math.min(29, Math.floor((ox + maxDist) / TILE));
  const minTy = Math.max(0, Math.floor((oy - maxDist) / TILE));
  const maxTy = Math.min(19, Math.floor((oy + maxDist) / TILE));
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isSolid(level, tx, ty)) continue;
      const rx = tx * TILE;
      const ry = ty * TILE;
      let tmin = 0;
      let tmax = best;
      let ok = true;
      // X slab
      if (dx === 0) {
        if (ox < rx || ox > rx + TILE) ok = false;
      } else {
        let ta = (rx - ox) / dx;
        let tb = (rx + TILE - ox) / dx;
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        if (ta > tmin) tmin = ta;
        if (tb < tmax) tmax = tb;
        if (tmin > tmax) ok = false;
      }
      // Y slab
      if (ok) {
        if (dy === 0) {
          if (oy < ry || oy > ry + TILE) ok = false;
        } else {
          let ta = (ry - oy) / dy;
          let tb = (ry + TILE - oy) / dy;
          if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
          if (ta > tmin) tmin = ta;
          if (tb < tmax) tmax = tb;
          if (tmin > tmax) ok = false;
        }
      }
      if (ok && tmin >= 0 && tmin < best) best = tmin;
    }
  }
  return best;
}

export class Guard {
  constructor(def, level) {
    this.level = level;
    this.waypoints = def.path.map(([tx, ty]) => ({
      x: tx * TILE + TILE / 2,
      y: ty * TILE + TILE / 2,
    }));
    this.pauseTime = def.pause || 1;
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    this.waypointIndex = 1 % this.waypoints.length;
    this.facing = 0;
    this.state = 'patrol'; // patrol | pause | suspicious | alert | search | return
    this.meter = 0; // 0..100 suspicion
    this.stateTime = 0;
    this.loseSightTime = 0;
    this.lastSeen = null;
    this.investigateTarget = null;
    this.scanAngle = 0;
    this.radius = 12;
    this.wasSuspicious = false;
    this.faceWaypoint();
  }

  faceWaypoint() {
    const wp = this.waypoints[this.waypointIndex];
    this.facing = Math.atan2(wp.y - this.y, wp.x - this.x);
  }

  // How clearly the guard can see the player right now, 0..1.
  visibilityOf(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > VISION_RANGE) return 0;
    const angle = Math.atan2(dy, dx);
    let diff = angle - this.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > VISION_HALF_ANGLE) return 0;
    if (!hasLineOfSight(this.level, this.x, this.y, player.x, player.y)) return 0;
    const closeness = 1 - (dist / VISION_RANGE) * 0.65;
    const tile = tileAt(this.level, player.x, player.y);
    const inShadow = this.level.shadows.has(tile.tx + ',' + tile.ty);
    let v = closeness;
    if (player.sneaking) v *= 0.55;
    if (inShadow) v *= 0.45;
    if (player.moving) v *= 1.15;
    return Math.max(0, Math.min(1, v));
  }

  // The vision cone as a polygon, clipped by walls, for rendering.
  // Base rays sweep the cone, and extra rays bracket every nearby solid
  // corner, so the cone hugs wall and crate edges instead of spiking
  // past a corner between two samples.
  conePolygon() {
    const angles = [];
    const rays = 26;
    for (let i = 0; i <= rays; i++) {
      angles.push(this.facing - VISION_HALF_ANGLE + (2 * VISION_HALF_ANGLE * i) / rays);
    }
    const reach = VISION_RANGE + TILE;
    const minTx = Math.max(0, Math.floor((this.x - reach) / TILE));
    const maxTx = Math.min(29, Math.floor((this.x + reach) / TILE));
    const minTy = Math.max(0, Math.floor((this.y - reach) / TILE));
    const maxTy = Math.min(19, Math.floor((this.y + reach) / TILE));
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (!isSolid(this.level, tx, ty)) continue;
        const corners = [
          [tx * TILE, ty * TILE],
          [tx * TILE + TILE, ty * TILE],
          [tx * TILE, ty * TILE + TILE],
          [tx * TILE + TILE, ty * TILE + TILE],
        ];
        for (const [cx, cy] of corners) {
          const a = Math.atan2(cy - this.y, cx - this.x);
          let diff = a - this.facing;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (Math.abs(diff) > VISION_HALF_ANGLE + 0.02) continue;
          angles.push(a - 0.0015, a + 0.0015);
        }
      }
    }
    angles.sort((a, b) => a - b);
    const points = [{ x: this.x, y: this.y }];
    let prev = null;
    for (const a of angles) {
      if (prev !== null && Math.abs(a - prev) < 0.0005) continue;
      prev = a;
      const d = rayDistance(this.level, this.x, this.y, Math.cos(a), Math.sin(a), VISION_RANGE);
      points.push({ x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d });
    }
    return points;
  }

  hearNoise(noise) {
    if (this.state === 'alert') return;
    const dist = Math.hypot(noise.x - this.x, noise.y - this.y);
    if (dist > noise.radius) return;
    this.investigateTarget = { x: noise.x, y: noise.y };
    this.meter = Math.max(this.meter, 55);
    if (this.state === 'patrol' || this.state === 'pause' || this.state === 'return') {
      this.setState('suspicious');
    }
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
  }

  moveToward(tx, ty, speed, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return true;
    const step = Math.min(dist, speed * dt);
    const nx = this.x + (dx / dist) * step;
    const ny = this.y + (dy / dist) * step;
    this.facing = Math.atan2(dy, dx);
    // Axis-separated slide against solid tiles.
    if (!this.hitsSolid(nx, this.y)) this.x = nx;
    if (!this.hitsSolid(this.x, ny)) this.y = ny;
    return dist - step < 2;
  }

  hitsSolid(px, py) {
    const r = this.radius - 2;
    const corners = [
      [px - r, py - r], [px + r, py - r],
      [px - r, py + r], [px + r, py + r],
    ];
    return corners.some(([cx, cy]) => {
      const t = tileAt(this.level, cx, cy);
      return isSolid(this.level, t.tx, t.ty);
    });
  }

  update(dt, player, events) {
    this.stateTime += dt;
    const vis = this.visibilityOf(player);

    // Suspicion meter: fills while the player is seen, drains when hidden.
    if (vis > 0) {
      this.meter += vis * 95 * dt;
      this.lastSeen = { x: player.x, y: player.y };
      this.loseSightTime = 0;
    } else {
      this.meter -= 28 * dt;
      this.loseSightTime += dt;
    }
    this.meter = Math.max(0, Math.min(100, this.meter));

    if (this.meter >= 100 && this.state !== 'alert') {
      this.setState('alert');
      events.onAlert(this);
    }
    if (this.meter >= 45 && !this.wasSuspicious && this.state !== 'alert') {
      events.onSuspicious(this);
    }
    this.wasSuspicious = this.meter >= 45;

    switch (this.state) {
      case 'patrol': {
        const wp = this.waypoints[this.waypointIndex];
        if (this.moveToward(wp.x, wp.y, PATROL_SPEED, dt)) {
          this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
          this.setState('pause');
        }
        if (this.meter >= 45) this.setState('suspicious');
        break;
      }
      case 'pause': {
        // Look around at the waypoint before moving on.
        this.facing += dt * 1.4;
        if (this.stateTime >= this.pauseTime) {
          this.faceWaypoint();
          this.setState('patrol');
        }
        if (this.meter >= 45) this.setState('suspicious');
        break;
      }
      case 'suspicious': {
        const target = this.lastSeen && this.meter >= 45 ? this.lastSeen : this.investigateTarget;
        if (target) {
          if (this.moveToward(target.x, target.y, INVESTIGATE_SPEED, dt)) {
            this.setState('search');
          }
        } else {
          this.setState('search');
        }
        if (this.meter < 20 && !target) this.setState('return');
        break;
      }
      case 'alert': {
        if (this.lastSeen) {
          this.moveToward(this.lastSeen.x, this.lastSeen.y, CHASE_SPEED, dt);
        }
        // Give up the chase after losing sight for a while.
        if (vis <= 0 && this.loseSightTime > 3.5) {
          this.setState('search');
        }
        break;
      }
      case 'search': {
        // Scan the area, then give up and head back.
        this.facing += dt * 2.2;
        if (this.stateTime > 2.4) this.setState('return');
        if (this.meter >= 45) this.setState('suspicious');
        break;
      }
      case 'return': {
        // Walk back to the nearest waypoint, then resume the patrol.
        let nearest = 0;
        let nearestDist = Infinity;
        this.waypoints.forEach((wp, i) => {
          const d = Math.hypot(wp.x - this.x, wp.y - this.y);
          if (d < nearestDist) { nearestDist = d; nearest = i; }
        });
        this.waypointIndex = (nearest + 1) % this.waypoints.length;
        const wp = this.waypoints[nearest];
        if (this.moveToward(wp.x, wp.y, RETURN_SPEED, dt)) {
          this.faceWaypoint();
          this.setState('patrol');
        }
        if (this.meter >= 45) this.setState('suspicious');
        break;
      }
      default:
        break;
    }
  }
}
