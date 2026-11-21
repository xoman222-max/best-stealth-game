// engine.js: the Game — loop, input, level flow, screens, HUD, and the
// glue between the player, the guards, the sounds, and the renderer.

import { TILE, LEVELS, parseLevel, tileAt } from './levels.js';
import { Guard, CATCH_DIST } from './guard.js';
import { Player } from './player.js';
import { SoundEngine } from './audio.js';
import {
  drawLevel, drawParcels, drawPings, drawDecoys,
  drawCone, drawGuard, drawPlayer, drawAlertVignette,
} from './render.js';

const $ = (id) => document.getElementById(id);

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sound = new SoundEngine();
    this.state = 'title'; // title | playing | paused | levelclear | caught | gameclear
    this.levelIndex = 0;
    this.level = null;
    this.player = null;
    this.guards = [];
    this.pings = [];
    this.floorCoins = [];
    this.levelTime = 0;
    this.totalTime = 0;
    this.levelDetections = 0;
    this.totalDetections = 0;
    this.totalParcels = 0;
    this.time = 0;
    this.frozen = false;
    this.lastFrame = 0;
    this.lockedToastAt = 0;
    this.input = { left: false, right: false, up: false, down: false, sneak: false };
    this.mouse = { x: 0, y: 0 };
    this.loadLevel(0);
  }

  // --- level flow -------------------------------------------------------

  loadLevel(index) {
    this.levelIndex = index;
    const def = LEVELS[index];
    this.level = parseLevel(def);
    const start = this.level.playerStart;
    if (!this.player) {
      this.player = new Player(start.tx * TILE + TILE / 2, start.ty * TILE + TILE / 2);
    }
    this.player.reset(start.tx * TILE + TILE / 2, start.ty * TILE + TILE / 2, def.decoys);
    this.guards = def.guards.map((g) => new Guard(g, this.level));
    this.pings = [];
    this.floorCoins = [];
    this.levelTime = 0;
    this.levelDetections = 0;
    this.updateHud();
  }

  startGame() {
    this.sound.ensure();
    this.sound.startAmbient();
    this.totalTime = 0;
    this.totalDetections = 0;
    this.totalParcels = 0;
    this.loadLevel(0);
    this.setState('playing');
    this.toast('Grab every parcel, then reach the EXIT unseen.');
  }

  restartLevel() {
    this.loadLevel(this.levelIndex);
    this.setState('playing');
  }

  nextLevel() {
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.showGameClear();
      return;
    }
    this.loadLevel(this.levelIndex + 1);
    this.setState('playing');
    this.toast(LEVELS[this.levelIndex].name + ' — ' + LEVELS[this.levelIndex].sub);
  }

  onCaught() {
    this.sound.caught();
    this.setState('caught');
  }

  onLevelClear() {
    this.sound.levelClear();
    this.totalParcels += this.level.parcels.length;
    this.setState('levelclear');
  }

  showGameClear(stats) {
    this.sound.gameWin();
    if (stats) {
      this.totalTime = stats.time;
      this.totalDetections = stats.detections;
      this.totalParcels = stats.parcels;
    }
    this.setState('gameclear');
  }

  // --- screens ----------------------------------------------------------

  setState(state) {
    this.state = state;
    const overlay = $('overlay');
    const card = $('overlay-card');
    if (state === 'playing') {
      overlay.classList.remove('show');
      return;
    }
    overlay.classList.add('show');
    if (state === 'title') {
      card.innerHTML =
        '<h1>SHADOW COURIER</h1>' +
        '<p class="tagline">Night has fallen over the depot. You are the courier ' +
        'sent to take back what was stolen — slip past the guards, ' +
        'grab every parcel, and reach the exit unseen.</p>' +
        '<div class="controls">' +
        '<b>WASD / Arrows</b> — move &nbsp;·&nbsp; <b>Shift</b> — sneak (slow, quiet, hard to spot)<br>' +
        '<b>Click</b> — toss a coin to lure a guard &nbsp;·&nbsp; <b>M</b> — mute &nbsp;·&nbsp; <b>P</b> — pause &nbsp;·&nbsp; <b>R</b> — restart level<br>' +
        'Dark floor hides you. Crates and walls block a guard&rsquo;s sight. ' +
        'A guard&rsquo;s suspicion drains when you break line of sight — ' +
        'but at full suspicion, it chases.</div>' +
        '<button class="big-btn" id="btn-start">START THE JOB</button>' +
        '<p class="small">Three levels · best played with sound on · runs fully offline</p>';
      $('btn-start').addEventListener('click', () => this.startGame());
    } else if (state === 'levelclear') {
      const left = this.level.parcels.filter((p) => !p.taken).length;
      card.innerHTML =
        '<h2>LEVEL CLEAR</h2>' +
        '<p class="tagline">' + LEVELS[this.levelIndex].name + ' — all parcels secured.</p>' +
        '<div class="stats">' +
        '<span><b>' + fmtTime(this.levelTime) + '</b>time</span>' +
        '<span><b>' + this.levelDetections + '</b>times spotted</span>' +
        '<span><b>' + (this.level.parcels.length - left) + ' / ' + this.level.parcels.length + '</b>parcels</span>' +
        '</div>' +
        '<button class="big-btn" id="btn-next">' +
        (this.levelIndex + 1 >= LEVELS.length ? 'FINISH THE JOB' : 'NEXT LEVEL') + '</button>';
      $('btn-next').addEventListener('click', () => this.nextLevel());
    } else if (state === 'caught') {
      card.innerHTML =
        '<h2>CAUGHT!</h2>' +
        '<p class="tagline">A guard got its hands on you. The parcels are still ' +
        'in there — and the patrols have not changed. Try a quieter route.</p>' +
        '<button class="big-btn" id="btn-retry">TRY AGAIN</button>' +
        '<p class="small">Tip: hold Shift to sneak, toss a coin to pull a guard away, ' +
        'and wait in the dark until suspicion drains.</p>';
      $('btn-retry').addEventListener('click', () => this.restartLevel());
    } else if (state === 'gameclear') {
      card.innerHTML =
        '<h1>JOB DONE</h1>' +
        '<p class="tagline">Every parcel is back in your hands and no guard ever ' +
        'laid a finger on you. The night is yours, courier.</p>' +
        '<div class="stats">' +
        '<span><b>' + fmtTime(this.totalTime) + '</b>total time</span>' +
        '<span><b>' + this.totalDetections + '</b>times spotted</span>' +
        '<span><b>' + this.totalParcels + '</b>parcels recovered</span>' +
        '</div>' +
        '<button class="big-btn" id="btn-again">PLAY AGAIN</button>';
      $('btn-again').addEventListener('click', () => this.startGame());
    } else if (state === 'paused') {
      card.innerHTML =
        '<h2>PAUSED</h2>' +
        '<p class="tagline">The guards wait. Take a breath.</p>' +
        '<button class="big-btn" id="btn-resume">RESUME</button>';
      $('btn-resume').addEventListener('click', () => this.setState('playing'));
    }
  }

  toast(text, ms) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), ms || 3200);
  }

  // --- HUD --------------------------------------------------------------

  updateHud() {
    const def = LEVELS[this.levelIndex];
    $('hud-level').textContent = def.name;
    const taken = this.level ? this.level.parcels.filter((p) => p.taken).length : 0;
    const total = this.level ? this.level.parcels.length : 0;
    $('hud-parcels').textContent = '◆ ' + taken + ' / ' + total + ' parcels';
    $('hud-decoys').textContent = '● ' + (this.player ? this.player.decoys : def.decoys) + ' coins';
    $('hud-time').textContent = fmtTime(this.levelTime);
    const pill = $('hud-alert');
    const anyAlert = this.guards.some((g) => g.state === 'alert');
    const maxMeter = this.guards.reduce((m, g) => Math.max(m, g.meter), 0);
    if (anyAlert) {
      pill.textContent = '! ALERTED';
      pill.className = 'pill alerted';
    } else if (maxMeter >= 45) {
      pill.textContent = '? SUSPICIOUS';
      pill.className = 'pill suspicious';
    } else {
      pill.textContent = 'CALM';
      pill.className = 'pill calm';
    }
  }

  // --- input ------------------------------------------------------------

  bindInput() {
    const keyMap = {
      KeyW: 'up', ArrowUp: 'up',
      KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
      ShiftLeft: 'sneak', ShiftRight: 'sneak',
    };
    window.addEventListener('keydown', (e) => {
      this.sound.ensure();
      const dir = keyMap[e.code];
      if (dir) {
        this.input[dir] = true;
        e.preventDefault();
      }
      if (e.code === 'KeyM') {
        this.sound.setMuted(!this.sound.muted);
        this.toast(this.sound.muted ? 'Sound off.' : 'Sound on.');
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === 'playing') this.setState('paused');
        else if (this.state === 'paused') this.setState('playing');
      }
      if (e.code === 'KeyR' && (this.state === 'playing' || this.state === 'caught')) {
        this.restartLevel();
      }
      if (e.code === 'Enter' && this.state === 'title') this.startGame();
      if (e.code === 'Enter' && this.state === 'levelclear') this.nextLevel();
      if (e.code === 'Enter' && this.state === 'caught') this.restartLevel();
    });
    window.addEventListener('keyup', (e) => {
      const dir = keyMap[e.code];
      if (dir) this.input[dir] = false;
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    });
    this.canvas.addEventListener('click', (e) => {
      this.sound.ensure();
      if (this.state !== 'playing') return;
      const rect = this.canvas.getBoundingClientRect();
      const tx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const ty = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      const landing = this.player.throwDecoy(tx, ty);
      if (!landing) {
        this.toast('Out of coins.');
        return;
      }
      this.floorCoins.push({ x: landing.x, y: landing.y, age: 0 });
      this.addPing(landing.x, landing.y, 190, 1.1);
      this.sound.coinLand();
      this.guards.forEach((g) => g.hearNoise({ x: landing.x, y: landing.y, radius: 190 }));
      this.updateHud();
    });
  }

  addPing(x, y, radius, life) {
    this.pings.push({ x, y, radius, age: 0, life: life || 0.9 });
  }

  // --- update -----------------------------------------------------------

  update(dt) {
    this.time += dt;
    if (this.state === 'title') {
      // Attract mode: guards patrol behind the title card.
      this.guards.forEach((g) => g.update(dt, this.player, {
        onAlert: () => {},
        onSuspicious: () => {},
      }));
      return;
    }
    if (this.state !== 'playing') return;

    this.levelTime += dt;
    this.totalTime += dt;

    const events = {
      onFootstep: (x, y, radius, sneaking) => {
        this.addPing(x, y, radius, 0.7);
        this.sound.footstep(sneaking);
        this.guards.forEach((g) => g.hearNoise({ x, y, radius }));
      },
      onAlert: (guard) => {
        this.levelDetections += 1;
        this.totalDetections += 1;
        this.sound.alertSting();
      },
      onSuspicious: () => {
        this.sound.suspicious();
      },
    };

    this.player.update(dt, this.input, this.level, events);
    this.guards.forEach((g) => g.update(dt, this.player, events));

    // Coin decoys fade after a while.
    this.floorCoins = this.floorCoins.filter((c) => {
      c.age += dt;
      return c.age < 4;
    });
    this.pings = this.pings.filter((p) => {
      p.age += dt;
      return p.age < p.life;
    });

    // Pick up parcels by walking over them.
    const pt = tileAt(this.level, this.player.x, this.player.y);
    this.level.parcels.forEach((parcel) => {
      if (!parcel.taken && parcel.tx === pt.tx && parcel.ty === pt.ty) {
        parcel.taken = true;
        this.sound.pickup();
        const left = this.level.parcels.filter((p) => !p.taken).length;
        if (left === 0) {
          this.level.exitOpen = true;
          this.sound.doorOpen();
          this.toast('All parcels secured — the EXIT is open!');
        } else {
          this.toast('Parcel secured — ' + left + ' to go.');
        }
      }
    });

    // Caught? A guard that touches the courier ends the level.
    for (const guard of this.guards) {
      const d = Math.hypot(guard.x - this.player.x, guard.y - this.player.y);
      if (d < CATCH_DIST) {
        this.onCaught();
        return;
      }
    }

    // Reached the exit?
    if (this.level.exit.tx === pt.tx && this.level.exit.ty === pt.ty) {
      if (this.level.exitOpen) {
        this.onLevelClear();
        return;
      }
      if (this.time - this.lockedToastAt > 2.5) {
        this.lockedToastAt = this.time;
        this.toast('Locked — collect every parcel first.');
      }
    }

    this.updateHud();
  }

  // --- render -----------------------------------------------------------

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    drawLevel(ctx, this.level, this.time);
    drawParcels(ctx, this.level, this.time);
    drawDecoys(ctx, this.floorCoins);
    this.guards.forEach((g) => drawCone(ctx, g));
    this.guards.forEach((g) => drawGuard(ctx, g, this.time));
    drawPings(ctx, this.pings);
    drawPlayer(ctx, this.player, this.time);
    const anyAlert = this.guards.some((g) => g.state === 'alert');
    drawAlertVignette(ctx, anyAlert, this.time);
  }

  loop = (now) => {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000 || 0.016);
    this.lastFrame = now;
    if (!this.frozen) this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  };

  run() {
    this.bindInput();
    this.setState('title');
    this.lastFrame = performance.now();
    requestAnimationFrame(this.loop);
  }

  // --- staged states for screenshots ------------------------------------
  // Each preset arranges the live game into a state real play reaches,
  // then freezes the frame so the screenshot is stable.

  applyShot(name) {
    this.frozen = false;
    if (name === 'start') {
      this.loadLevel(0);
      this.setState('title');
      return;
    }
    if (name === 'play') {
      this.loadLevel(0);
      this.level.parcels[1].taken = true; // one parcel already grabbed
      this.player.x = 10 * TILE + 16;
      this.player.y = 14 * TILE + 16;
      this.player.sneaking = true;
      this.player.facing = -Math.PI / 2;
      this.input.sneak = true; // hold the sneak pose while the frame settles
      const guard = this.guards[0];
      guard.x = 10 * TILE + 16;
      guard.y = 12 * TILE + 16;
      guard.facing = Math.PI / 2;
      guard.meter = 62;
      guard.state = 'suspicious';
      guard.lastSeen = { x: this.player.x, y: this.player.y };
      guard.waypointIndex = 1;
      this.setState('playing');
      this.updateHud();
      this.freezeAfterTicks(6);
      return;
    }
    if (name === 'alert') {
      this.loadLevel(0);
      this.level.parcels[0].taken = true;
      this.player.x = 17 * TILE + 16;
      this.player.y = 13 * TILE + 16;
      this.player.facing = Math.PI;
      const guard = this.guards[1];
      guard.x = 13 * TILE + 16;
      guard.y = 13 * TILE + 16;
      guard.facing = 0;
      guard.meter = 100;
      guard.state = 'alert';
      guard.lastSeen = { x: this.player.x, y: this.player.y };
      guard.loseSightTime = 0;
      this.levelDetections = 1;
      this.totalDetections = 1;
      this.setState('playing');
      this.updateHud();
      this.freezeAfterTicks(6);
      return;
    }
    if (name === 'win') {
      this.loadLevel(2);
      this.showGameClear({ time: 462, detections: 3, parcels: 12 });
      return;
    }
  }

  freezeAfterTicks(n) {
    // Let a few simulation ticks settle positions, then hold the frame.
    for (let i = 0; i < n; i++) this.update(1 / 60);
    this.frozen = true;
  }
}
