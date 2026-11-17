// Voidstorm's boot and frame loop: wires the canvas, input, audio and
// renderer to the world, runs the simulation on a fixed step, turns world
// events into sounds, and handles the title / pause / game-over flow.
// With ?shot=start|play|end&seed=N it stages one deterministic frame
// instead, which is how the screenshots in shots.json are taken.

import { BEST_KEY, FIELD, STEP } from './config.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { computeView, drawGame } from './render.js';
import { stageShot } from './shots.js';
import {
  EV_BOMB,
  EV_DASH,
  EV_EXPLODE,
  EV_HIT,
  EV_HURT,
  EV_OVER,
  EV_PICKUP,
  EV_SHOOT,
  EV_WAVE,
  createWorld,
} from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') ?? '7', 10) || 7;

const audio = createAudio();
const world = createWorld(seed);
const ui = { best: 0, muted: false, paused: false, isBest: false };

try {
  ui.best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
} catch {
  ui.best = 0;
}

let view = { scale: 1, offsetX: 0, offsetY: 0 };
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  view = computeView(canvas);
}
window.addEventListener('resize', resize);
resize();

function toField(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.offsetX) / view.scale,
    y: (clientY - rect.top - view.offsetY) / view.scale,
  };
}

const input = createInput(canvas, toField);

function playEvents(events) {
  if (events & EV_SHOOT) audio.shoot();
  if (events & EV_HIT) audio.enemyHit();
  if (events & EV_EXPLODE) audio.explode(false);
  if (events & EV_BOMB) audio.bomb();
  if (events & EV_HURT) audio.hurt();
  if (events & EV_PICKUP) audio.pickup();
  if (events & EV_DASH) audio.dash();
  if (events & EV_WAVE) audio.wave();
  if (events & EV_OVER) audio.gameOver();
}

function startRun() {
  audio.unlock();
  audio.start();
  ui.isBest = false;
  ui.paused = false;
  world.startRun();
  status.textContent = 'Voidstorm started. Wave 1.';
}

function currentControl() {
  const move = input.moveVector();
  return {
    moveX: move.x,
    moveY: move.y,
    aimX: input.mouse.x,
    aimY: input.mouse.y,
    firing: input.mouse.down || input.keys.has('Space'),
    dash: input.pressed.has('ShiftLeft') || input.pressed.has('ShiftRight'),
  };
}

function handleFlow() {
  const state = world.state;
  if (input.pressed.has('KeyM')) ui.muted = audio.toggleMute();
  if (state.phase === 'title') {
    if (input.pressed.has('Enter') || input.mouse.clicked) startRun();
  } else if (state.phase === 'over') {
    if (state.score > ui.best) {
      ui.best = state.score;
      ui.isBest = true;
      try {
        window.localStorage.setItem(BEST_KEY, String(ui.best));
      } catch {
        // Private mode: the best score simply lasts for this visit.
      }
    }
    if (state.overTimer > 0.7 && (input.pressed.has('KeyR') || input.mouse.clicked)) startRun();
  } else if (state.phase === 'playing') {
    if (input.pressed.has('KeyP')) ui.paused = !ui.paused;
  }
}

let lastStatus = '';
function announce() {
  const state = world.state;
  const text =
    state.phase === 'title'
      ? 'Voidstorm title screen. Press Enter or click to launch.'
      : state.phase === 'over'
        ? `Game over. Score ${state.score}. Press R to fly again.`
        : `Wave ${state.wave}. Score ${state.score}. Hull ${state.lives}.`;
  if (text !== lastStatus) {
    lastStatus = text;
    status.textContent = text;
  }
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const shakeX = world.state.shake > 0 ? (Math.random() - 0.5) * world.state.shake : 0;
  const shakeY = world.state.shake > 0 ? (Math.random() - 0.5) * world.state.shake : 0;
  ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX + shakeX * view.scale, view.offsetY + shakeY * view.scale);
  drawGame(ctx, world, ui);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// Screenshot mode: stage one deterministic scene and hold it.
if (params.has('shot')) {
  stageShot(params.get('shot'), world);
  draw();
  requestAnimationFrame(() => {
    draw();
    window.__shotReady = true;
  });
} else {
  let previous = performance.now();
  let accumulator = 0;
  const frame = (now) => {
    requestAnimationFrame(frame);
    let elapsed = (now - previous) / 1000;
    previous = now;
    if (elapsed > 0.1) elapsed = 0.1;
    handleFlow();
    if (!ui.paused) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        const events = world.step(STEP, currentControl());
        playEvents(events);
      }
    }
    announce();
    draw();
    input.endFrame();
  };
  requestAnimationFrame(frame);
}

// A handle for local play-testing tools; the game never reads it.
window.__voidstorm = { world, ui, FIELD };
