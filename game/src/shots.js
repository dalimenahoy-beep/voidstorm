// The screenshot scenes behind ?shot=start|play|end&seed=N. Each one runs
// the real simulation forward from a fresh world, steered by an autopilot,
// so a screenshot is a frame the game itself produced and the same seed
// always gives the same frame.

import { FIELD, PLAYER, STEP } from './config.js';

const IDLE = { moveX: 0, moveY: 0, aimX: FIELD.width / 2, aimY: 0, firing: false, dash: false };

function nearestEnemy(state) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of state.enemies) {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = enemy;
    }
  }
  return best ? { enemy: best, dist: Math.sqrt(bestDist) } : null;
}

function nearestOrb(state) {
  let bestDist = Infinity;
  for (const orb of state.orbs) {
    const dx = orb.x - state.player.x;
    const dy = orb.y - state.player.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) bestDist = dist;
  }
  return Math.sqrt(bestDist);
}

/** A competent pilot: keeps its distance, strafes, aims with a little lead, dashes out of trouble. */
function goodPilot(state) {
  const player = state.player;
  const near = nearestEnemy(state);
  let moveX = 0;
  let moveY = 0;
  let aimX = player.x + Math.cos(player.angle) * 100;
  let aimY = player.y + Math.sin(player.angle) * 100;
  let firing = false;
  let dash = false;

  // Drift toward a pickup when nothing is close enough to punish it.
  let target = null;
  for (const pickup of state.pickups) {
    if (!target) target = pickup;
  }

  if (near) {
    const { enemy, dist } = near;
    const awayX = (player.x - enemy.x) / (dist || 1);
    const awayY = (player.y - enemy.y) / (dist || 1);
    if (dist < 240) {
      moveX = awayX + -awayY * 0.6;
      moveY = awayY + awayX * 0.6;
    } else if (dist > 420) {
      moveX = -awayX;
      moveY = -awayY;
    } else {
      moveX = -awayY * Math.sin(state.time * 0.8);
      moveY = awayX * Math.sin(state.time * 0.8);
    }
    const lead = Math.min(0.6, dist / PLAYER.bulletSpeed);
    aimX = enemy.x + enemy.vx * lead;
    aimY = enemy.y + enemy.vy * lead;
    firing = dist < 720;
    if (dist < 105 || nearestOrb(state) < 80) dash = true;
  } else if (target) {
    moveX = Math.sign(target.x - player.x);
    moveY = Math.sign(target.y - player.y);
    aimX = target.x;
    aimY = target.y;
  }
  // Stay off the walls.
  if (player.x < 90) moveX += 1;
  if (player.x > FIELD.width - 90) moveX -= 1;
  if (player.y < 90) moveY += 1;
  if (player.y > FIELD.height - 90) moveY -= 1;
  const length = Math.hypot(moveX, moveY);
  if (length > 1) {
    moveX /= length;
    moveY /= length;
  }
  return { moveX, moveY, aimX, aimY, firing, dash };
}

/** A doomed pilot: holds still and never fires. The swarm does the rest. */
function doomedPilot(state) {
  return { ...IDLE, aimX: state.player.x + 100, aimY: state.player.y };
}

/** Fly the good pilot for `seconds`, restarting the run if it ever ends. */
function flyFor(world, seconds) {
  const state = world.state;
  const steps = Math.round(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    if (state.phase === 'over') world.startRun();
    world.step(STEP, goodPilot(state));
  }
}

/**
 * Keep flying until the frame is genuinely busy — hostiles on screen,
 * bullets in the air and no wave banner over the top — or the cap runs out.
 */
function settleOnAction(world, capSeconds) {
  const state = world.state;
  const steps = Math.round(capSeconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    if (state.phase === 'over') world.startRun();
    world.step(STEP, goodPilot(state));
    // Count only hostiles well inside the arena: a frame of edge specks
    // reads as empty even when the wave is busy.
    let central = 0;
    for (const enemy of state.enemies) {
      if (enemy.x > 170 && enemy.x < FIELD.width - 170 && enemy.y > 100 && enemy.y < FIELD.height - 100) central += 1;
    }
    if (state.banner === null && central >= 3 && state.bullets.length >= 2) break;
  }
}

/**
 * Set `world` to the named scene (start, play, late or end; any other name
 * is start) and return the phase the frame should show.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'play' || name === 'late') {
    world.startRun();
    flyFor(world, name === 'late' ? 38 : 17);
    settleOnAction(world, 14);
    return 'playing';
  }
  if (name === 'end') {
    world.startRun();
    flyFor(world, 11);
    if (state.phase === 'over') world.startRun();
    const cap = Math.round(300 / STEP);
    for (let index = 0; index < cap && state.phase !== 'over'; index += 1) {
      world.step(STEP, doomedPilot(state));
    }
    for (let index = 0; index < Math.round(1.1 / STEP); index += 1) world.step(STEP, IDLE);
    return 'over';
  }
  world.reset();
  for (let index = 0; index < Math.round(4 / STEP); index += 1) world.step(STEP, IDLE);
  return 'title';
}
