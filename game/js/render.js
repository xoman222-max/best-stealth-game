// render.js: draws the whole night scene on the canvas — floor, shadows,
// walls, crates, exit, parcels, vision cones, guards, and the courier.

import { TILE, MAP_COLS, MAP_ROWS } from './levels.js';
import { VISION_RANGE } from './guard.js';

// Draw the static level: floor tiles, shadow zones, walls, crates, exit.
export function drawLevel(ctx, level, time) {
  // Floor: two-tone checker, darker where the shadows fall.
  for (let ty = 0; ty < MAP_ROWS; ty++) {
    for (let tx = 0; tx < MAP_COLS; tx++) {
      const key = tx + ',' + ty;
      const px = tx * TILE;
      const py = ty * TILE;
      if (level.walls.has(key)) continue;
      const dark = (tx + ty) % 2 === 0;
      const shadow = level.shadows.has(key);
      if (shadow) {
        ctx.fillStyle = dark ? '#0e1622' : '#0d141f';
      } else {
        ctx.fillStyle = dark ? '#1d2836' : '#1a2431';
      }
      ctx.fillRect(px, py, TILE, TILE);
      if (shadow) {
        // Diagonal hatch marks the hiding dark.
        ctx.strokeStyle = 'rgba(120, 160, 200, 0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 6, py + TILE - 6);
        ctx.lineTo(px + TILE - 6, py + 6);
        ctx.stroke();
      }
      // Faint tile seams.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.strokeRect(px + 0.5, py + 0.5, TILE, TILE);
    }
  }

  // Crates: wooden boxes you can hide behind.
  level.crates.forEach((key) => {
    const [tx, ty] = key.split(',').map(Number);
    const px = tx * TILE;
    const py = ty * TILE;
    ctx.fillStyle = '#5d4126';
    ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
    ctx.strokeStyle = '#8a6136';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.beginPath();
    ctx.moveTo(px + 3, py + 3);
    ctx.lineTo(px + TILE - 3, py + TILE - 3);
    ctx.moveTo(px + TILE - 3, py + 3);
    ctx.lineTo(px + 3, py + TILE - 3);
    ctx.stroke();
  });

  // Walls: dark slabs with a lit top edge so the maze reads at a glance.
  level.walls.forEach((key) => {
    const [tx, ty] = key.split(',').map(Number);
    const px = tx * TILE;
    const py = ty * TILE;
    ctx.fillStyle = '#0a111c';
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = '#2c4056';
    ctx.fillRect(px, py, TILE, 3);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fillRect(px, py + 3, TILE, 4);
  });

  drawExit(ctx, level, time);
}

function drawExit(ctx, level, time) {
  const ex = level.exit.tx * TILE;
  const ey = level.exit.ty * TILE;
  const cx = ex + TILE / 2;
  const cy = ey + TILE / 2;
  const open = level.exitOpen;
  const pulse = 0.55 + Math.sin(time * 3) * 0.25;

  // Glow on the floor around the door.
  const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 46);
  glow.addColorStop(0, open ? `rgba(80, 255, 150, ${0.35 * pulse})` : `rgba(255, 90, 70, ${0.22 * pulse})`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 48, cy - 48, 96, 96);

  // Door frame.
  ctx.fillStyle = open ? '#12351f' : '#3a1512';
  ctx.fillRect(ex + 3, ey + 3, TILE - 6, TILE - 6);
  ctx.strokeStyle = open ? '#4be389' : '#e05a4a';
  ctx.lineWidth = 2;
  ctx.strokeRect(ex + 4, ey + 4, TILE - 8, TILE - 8);

  // The door itself: green EXIT when open, a red LOCK while locked.
  ctx.fillStyle = open ? '#4be389' : '#e05a4a';
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(open ? 'EXIT' : 'LOCK', cx, cy - 1);
}

// Parcels: gold diamonds that bob gently until collected.
export function drawParcels(ctx, level, time) {
  level.parcels.forEach((parcel) => {
    if (parcel.taken) return;
    const cx = parcel.tx * TILE + TILE / 2;
    const cy = parcel.ty * TILE + TILE / 2 + Math.sin(time * 2.4 + parcel.tx) * 2;
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
    glow.addColorStop(0, 'rgba(255, 214, 110, 0.5)');
    glow.addColorStop(1, 'rgba(255, 214, 110, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 24, cy - 24, 48, 48);
    ctx.fillStyle = '#ffd66e';
    ctx.strokeStyle = '#a67c1a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 9);
    ctx.lineTo(cx + 9, cy);
    ctx.lineTo(cx, cy + 9);
    ctx.lineTo(cx - 9, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7a5a10';
    ctx.fillRect(cx - 1.5, cy - 5, 3, 10);
  });
}

// Expanding noise rings from footsteps and coin landings.
export function drawPings(ctx, pings) {
  pings.forEach((ping) => {
    const age = ping.age / ping.life;
    const r = 8 + age * ping.radius;
    ctx.strokeStyle = `rgba(255, 220, 130, ${0.55 * (1 - age)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ping.x, ping.y, r, 0, Math.PI * 2);
    ctx.stroke();
  });
}

// A tossed coin waiting on the floor.
export function drawDecoys(ctx, decoys) {
  decoys.forEach((coin) => {
    ctx.fillStyle = '#ffd66e';
    ctx.strokeStyle = '#a67c1a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#a67c1a';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', coin.x, coin.y + 0.5);
  });
}

// One guard's vision cone, clipped by walls, coloured by alertness.
// A radial falloff keeps the far edge soft, so light wrapping around a
// crate corner reads as a glow rather than a hard spike.
export function drawCone(ctx, guard) {
  const poly = guard.conePolygon();
  let rgb;
  let baseAlpha;
  if (guard.state === 'alert') { rgb = '255, 70, 55'; baseAlpha = 0.34; }
  else if (guard.meter >= 45) { rgb = '255, 170, 60'; baseAlpha = 0.30; }
  else { rgb = '255, 220, 90'; baseAlpha = 0.24; }
  const falloff = ctx.createRadialGradient(guard.x, guard.y, 8, guard.x, guard.y, VISION_RANGE);
  falloff.addColorStop(0, `rgba(${rgb}, ${baseAlpha})`);
  falloff.addColorStop(0.7, `rgba(${rgb}, ${baseAlpha * 0.85})`);
  falloff.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = falloff;
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb}, 0.35)`;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// A guard: body, facing visor, suspicion arc, and ? / ! markers.
export function drawGuard(ctx, guard, time) {
  // Soft shadow blob.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(guard.x, guard.y + 7, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const alerted = guard.state === 'alert';
  const body = alerted ? '#e5483c' : guard.meter >= 45 ? '#e8862e' : '#d96a3b';
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a150c';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Visor wedge showing where the guard faces.
  ctx.fillStyle = '#ffe9c4';
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.arc(guard.x, guard.y, guard.radius - 2, guard.facing - 0.5, guard.facing + 0.5);
  ctx.closePath();
  ctx.fill();

  // Suspicion arc above the head.
  if (guard.meter > 4) {
    const frac = guard.meter / 100;
    ctx.strokeStyle = alerted ? '#ff5a48' : '#ffcf6e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y - 18, 8, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
  }

  // Marker: ? while suspicious, ! while alerted, bobbing for attention.
  if (guard.state === 'alert' || guard.meter >= 45) {
    const bob = Math.sin(time * 6) * 2;
    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = alerted ? '#ff6a58' : '#ffcf6e';
    ctx.fillText(alerted ? '!' : '?', guard.x, guard.y - 30 + bob);
  }
}

// The courier: a cyan figure with a facing tick; crouched small while sneaking.
export function drawPlayer(ctx, player, time) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 7, 11, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const r = player.sneaking ? 8.5 : player.radius;
  ctx.fillStyle = '#37c8e8';
  ctx.beginPath();
  ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0b3542';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Facing tick.
  ctx.strokeStyle = '#eafcff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(player.x + Math.cos(player.facing) * (r - 2), player.y + Math.sin(player.facing) * (r - 2));
  ctx.lineTo(player.x + Math.cos(player.facing) * (r + 5), player.y + Math.sin(player.facing) * (r + 5));
  ctx.stroke();

  // Quiet ripple while sneaking, loud ring while walking.
  if (player.moving) {
    const pulse = (time * 2) % 1;
    ctx.strokeStyle = player.sneaking
      ? `rgba(120, 220, 255, ${0.35 * (1 - pulse)})`
      : `rgba(255, 220, 130, ${0.4 * (1 - pulse)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r + 4 + pulse * (player.sneaking ? 12 : 26), 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Red edge vignette while any guard is alerted.
export function drawAlertVignette(ctx, alerted, time) {
  if (!alerted) return;
  const pulse = 0.18 + Math.sin(time * 5) * 0.08;
  const grad = ctx.createRadialGradient(480, 320, 220, 480, 320, 480);
  grad.addColorStop(0, 'rgba(255, 40, 30, 0)');
  grad.addColorStop(1, `rgba(255, 40, 30, ${pulse})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 960, 640);
}
