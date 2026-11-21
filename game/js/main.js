// main.js: boots Shadow Courier and handles the ?shot= presets used for
// screenshots (start | play | alert | win). Each preset arranges the live
// game into a state real play reaches, then freezes the frame.

import { Game } from './engine.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = game;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

if (shot) {
  // Staged screenshot state: apply the preset, then start the render loop.
  game.applyShot(shot);
  game.bindInput();
  game.lastFrame = performance.now();
  requestAnimationFrame(game.loop);
} else {
  game.run();
}
