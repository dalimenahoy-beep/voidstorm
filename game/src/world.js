// The Voidstorm simulation: the player ship, five kinds of drone, bullets,
// orbs, pickups, waves and scoring. Pure state and rules — this file never
// touches the DOM or the canvas; render.js draws what lives here and
// main.js feeds it controls. step() returns a bitmask of events so the
// caller can play the matching sounds.

import { BULLET, COMBO, ENEMY, FIELD, ORB, PICKUP, PLAYER, WAVE } from './config.js';
import { createParticles } from './particles.js';
import { createRandom, range } from './random.js';

export const EV_SHOOT = 1;
export const EV_HIT = 2;
export const EV_EXPLODE = 4;
export const EV_HURT = 8;
export const EV_PICKUP = 16;
export const EV_WAVE = 32;
export const EV_OVER = 64;
export const EV_DASH = 128;
export const EV_BOMB = 256;

const TAU = Math.PI * 2;

export function createWorld(seed) {
  const random = createRandom(seed);
  const fx = createParticles(random);

  const state = {
    phase: 'title', // 'title' | 'playing' | 'over'
    time: 0,
    score: 0,
    lives: PLAYER.lives,
    wave: 0,
    combo: 0,
    comboTimer: 0,
    player: null,
    bullets: [],
    orbs: [],
    enemies: [],
    pickups: [],
    spawnQueue: [],
    spawnTimer: 0,
    waveState: 'idle', // 'banner' | 'active' | 'rest'
    waveTimer: 0,
    banner: null,
    shake: 0,
    flash: 0,
    overTimer: 0,
    kills: 0,
  };

  function freshPlayer() {
    return {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      fireTimer: 0,
      invulnTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      dashX: 0,
      dashY: 0,
      rapidTimer: 0,
      shieldTimer: 0,
      alive: true,
    };
  }
  state.player = freshPlayer();

  /** The score multiplier the current combo earns: x1 up to x3. */
  function multiplier() {
    return Math.min(1 + state.combo * 0.2, 3);
  }

  function spawnPoint() {
    // A random point on a random edge, kept away from the player.
    for (let tries = 0; tries < 12; tries += 1) {
      const edge = Math.floor(random() * 4);
      let x = 0;
      let y = 0;
      if (edge === 0) { x = range(random, 0, FIELD.width); y = -30; }
      if (edge === 1) { x = range(random, 0, FIELD.width); y = FIELD.height + 30; }
      if (edge === 2) { x = -30; y = range(random, 0, FIELD.height); }
      if (edge === 3) { x = FIELD.width + 30; y = range(random, 0, FIELD.height); }
      const dx = x - state.player.x;
      const dy = y - state.player.y;
      if (dx * dx + dy * dy > 260 * 260 || tries === 11) return { x, y };
    }
    return { x: -30, y: -30 };
  }

  function spawnEnemy(kind) {
    const spec = ENEMY[kind];
    const point = spawnPoint();
    const hpBonus = Math.floor((state.wave - 1) / WAVE.hpBonusEvery);
    const hp = spec.hp + (kind === 'mini' || kind === 'weaver' ? 0 : hpBonus);
    state.enemies.push({
      kind,
      x: point.x,
      y: point.y,
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      radius: spec.radius,
      speed: spec.speed * (1 + (state.wave - 1) * WAVE.speedPerWave) * range(random, 0.9, 1.1),
      angle: random() * TAU,
      t: range(random, 0, 10),
      fireTimer: range(random, 1.2, 2.6),
      score: spec.score,
    });
  }

  function buildWave(n) {
    const count = WAVE.baseCount + (n - 1) * WAVE.countPerWave;
    const weights = [
      ['chaser', 10],
      ['weaver', n >= 2 ? 4 + n * 0.3 : 0],
      ['splitter', n >= 3 ? 2 + n * 0.25 : 0],
      ['shooter', n >= 4 ? 2 + n * 0.3 : 0],
      ['mini', n >= 6 ? 2 : 0],
    ];
    const total = weights.reduce((sum, [, w]) => sum + w, 0);
    const queue = [];
    for (let index = 0; index < count; index += 1) {
      let roll = random() * total;
      for (const [kind, w] of weights) {
        roll -= w;
        if (roll <= 0) {
          queue.push(kind);
          break;
        }
      }
    }
    if (n % 5 === 0) queue.push('splitter', 'shooter', 'splitter', 'shooter');
    return queue;
  }

  function startWave(n) {
    state.wave = n;
    state.spawnQueue = buildWave(n);
    state.spawnTimer = 0.4;
    state.waveState = 'banner';
    state.waveTimer = WAVE.bannerTime;
    state.banner = {
      text: `WAVE ${n}`,
      sub: n % 5 === 0 ? 'SURGE INCOMING — heavy drones inbound' : n === 1 ? 'Drones inbound — good hunting' : '',
      t: 0,
    };
  }

  function dropPickup(x, y) {
    const roll = random();
    let kind = 'rapid';
    if (roll < 0.07) kind = 'life';
    else if (roll < 0.45) kind = 'rapid';
    else if (roll < 0.73) kind = 'shield';
    else kind = 'bomb';
    state.pickups.push({
      kind,
      x, y,
      vx: range(random, -30, 30),
      vy: range(random, -30, 30),
      life: PICKUP.life,
      t: 0,
    });
  }

  function killEnemy(enemy, events) {
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO.window;
    const points = Math.round(enemy.score * multiplier());
    state.score += points;
    fx.burst(enemy.x, enemy.y, enemyColor(enemy.kind), enemy.kind === 'splitter' ? 26 : 15, 340);
    if (enemy.kind === 'splitter' || enemy.kind === 'shooter') fx.ring(enemy.x, enemy.y, enemyColor(enemy.kind));
    fx.floater(enemy.x, enemy.y - enemy.radius, `+${points}`, '#eef2ff');
    if (enemy.kind === 'splitter') {
      for (let index = 0; index < 3; index += 1) {
        const angle = (index / 3) * TAU + random();
        state.enemies.push({
          kind: 'mini',
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * 190,
          vy: Math.sin(angle) * 190,
          hp: ENEMY.mini.hp,
          maxHp: ENEMY.mini.hp,
          radius: ENEMY.mini.radius,
          speed: ENEMY.mini.speed,
          angle,
          t: range(random, 0, 10),
          fireTimer: 0,
          score: ENEMY.mini.score,
        });
      }
    }
    if (random() < PICKUP.dropChance) dropPickup(enemy.x, enemy.y);
    return events | EV_EXPLODE;
  }

  function hurtPlayer(events) {
    const player = state.player;
    if (player.invulnTimer > 0 || state.phase !== 'playing') return events;
    if (player.shieldTimer > 0) {
      player.shieldTimer = 0;
      player.invulnTimer = 1.0;
      fx.ring(player.x, player.y, '#53f5d2');
      fx.burst(player.x, player.y, '#53f5d2', 12, 260);
      return events | EV_HIT;
    }
    state.lives -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    player.invulnTimer = PLAYER.invulnerable;
    state.shake = Math.min(state.shake + 14, 20);
    state.flash = 0.5;
    fx.burst(player.x, player.y, '#53f5d2', 24, 380);
    if (state.lives <= 0) {
      player.alive = false;
      state.phase = 'over';
      state.overTimer = 0;
      fx.burst(player.x, player.y, '#ffe066', 46, 460, 0.9, 4);
      fx.ring(player.x, player.y, '#ffe066');
      return events | EV_HURT | EV_OVER;
    }
    return events | EV_HURT;
  }

  function updatePlayer(dt, control, events) {
    const player = state.player;
    if (!player.alive) return events;
    player.fireTimer -= dt;
    player.invulnTimer = Math.max(0, player.invulnTimer - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.rapidTimer = Math.max(0, player.rapidTimer - dt);
    player.shieldTimer = Math.max(0, player.shieldTimer - dt);

    const aimDx = control.aimX - player.x;
    const aimDy = control.aimY - player.y;
    if (aimDx * aimDx + aimDy * aimDy > 4) player.angle = Math.atan2(aimDy, aimDx);

    if (control.dash && player.dashCooldown <= 0 && player.dashTimer <= 0) {
      const moveLength = Math.hypot(control.moveX, control.moveY);
      if (moveLength > 0.1) {
        player.dashX = control.moveX / moveLength;
        player.dashY = control.moveY / moveLength;
      } else {
        player.dashX = Math.cos(player.angle);
        player.dashY = Math.sin(player.angle);
      }
      player.dashTimer = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
      events |= EV_DASH;
    }

    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      player.vx = player.dashX * PLAYER.dashSpeed;
      player.vy = player.dashY * PLAYER.dashSpeed;
      fx.trail(player.x, player.y, '#53f5d2');
    } else {
      player.vx += control.moveX * PLAYER.accel * dt;
      player.vy += control.moveY * PLAYER.accel * dt;
      const drag = Math.max(0, 1 - PLAYER.drag * dt);
      player.vx *= drag;
      player.vy *= drag;
      const speed = Math.hypot(player.vx, player.vy);
      if (speed > PLAYER.maxSpeed) {
        player.vx = (player.vx / speed) * PLAYER.maxSpeed;
        player.vy = (player.vy / speed) * PLAYER.maxSpeed;
      }
      if (speed > 60) fx.trail(player.x - player.vx * 0.04, player.y - player.vy * 0.04, '#2b8f7d');
    }

    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + player.vx * dt));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + player.vy * dt));

    if (control.firing && player.fireTimer <= 0) {
      player.fireTimer = player.rapidTimer > 0 ? PLAYER.rapidInterval : PLAYER.fireInterval;
      const spread = range(random, -0.035, 0.035);
      const angle = player.angle + spread;
      state.bullets.push({
        x: player.x + Math.cos(player.angle) * (PLAYER.radius + 6),
        y: player.y + Math.sin(player.angle) * (PLAYER.radius + 6),
        vx: Math.cos(angle) * PLAYER.bulletSpeed,
        vy: Math.sin(angle) * PLAYER.bulletSpeed,
        life: BULLET.life,
      });
      events |= EV_SHOOT;
    }
    return events;
  }

  function steer(enemy, desiredX, desiredY, agility, dt) {
    enemy.vx += (desiredX - enemy.vx) * Math.min(1, agility * dt);
    enemy.vy += (desiredY - enemy.vy) * Math.min(1, agility * dt);
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
  }

  function updateEnemies(dt, events) {
    const player = state.player;
    for (const enemy of state.enemies) {
      enemy.t += dt;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      if (enemy.kind === 'chaser') {
        steer(enemy, ux * enemy.speed, uy * enemy.speed, 3.2, dt);
        enemy.angle = Math.atan2(enemy.vy, enemy.vx);
      } else if (enemy.kind === 'weaver') {
        const sway = Math.sin(enemy.t * 3.4) * 0.7;
        const cos = Math.cos(sway);
        const sin = Math.sin(sway);
        steer(enemy, (ux * cos - uy * sin) * enemy.speed, (ux * sin + uy * cos) * enemy.speed, 3.6, dt);
        enemy.angle = Math.atan2(enemy.vy, enemy.vx);
      } else if (enemy.kind === 'mini') {
        steer(enemy, ux * enemy.speed, uy * enemy.speed, 4.5, dt);
        enemy.angle = Math.atan2(enemy.vy, enemy.vx);
      } else if (enemy.kind === 'splitter') {
        steer(enemy, ux * enemy.speed, uy * enemy.speed, 2.2, dt);
        enemy.angle += dt * 0.7;
      } else if (enemy.kind === 'shooter') {
        let moveX = 0;
        let moveY = 0;
        if (dist > 330) { moveX = ux; moveY = uy; }
        else if (dist < 250) { moveX = -ux; moveY = -uy; }
        else { moveX = -uy * Math.sin(enemy.t * 0.9); moveY = ux * Math.sin(enemy.t * 0.9); }
        steer(enemy, moveX * enemy.speed, moveY * enemy.speed, 2.6, dt);
        enemy.angle = Math.atan2(dy, dx);
        enemy.fireTimer -= dt;
        if (enemy.fireTimer <= 0 && dist < 560 && state.phase === 'playing' && player.alive) {
          enemy.fireTimer = range(random, 1.7, 2.6);
          state.orbs.push({
            x: enemy.x + ux * (enemy.radius + 6),
            y: enemy.y + uy * (enemy.radius + 6),
            vx: ux * ORB.speed,
            vy: uy * ORB.speed,
            life: ORB.life,
          });
        }
      }
    }
    return events;
  }

  function collide(events) {
    const player = state.player;
    // Player bullets against enemies.
    for (let bi = state.bullets.length - 1; bi >= 0; bi -= 1) {
      const bullet = state.bullets[bi];
      let spent = false;
      for (let ei = state.enemies.length - 1; ei >= 0; ei -= 1) {
        const enemy = state.enemies[ei];
        const dx = enemy.x - bullet.x;
        const dy = enemy.y - bullet.y;
        const reach = enemy.radius + BULLET.radius;
        if (dx * dx + dy * dy < reach * reach) {
          spent = true;
          enemy.hp -= 1;
          fx.burst(bullet.x, bullet.y, enemyColor(enemy.kind), 4, 200, 0.3, 2.4);
          if (enemy.hp <= 0) {
            state.enemies.splice(ei, 1);
            events = killEnemy(enemy, events);
          } else {
            events |= EV_HIT;
          }
          break;
        }
      }
      if (spent) state.bullets.splice(bi, 1);
    }
    // Enemies against the player.
    if (player.alive && state.phase === 'playing') {
      for (let ei = state.enemies.length - 1; ei >= 0; ei -= 1) {
        const enemy = state.enemies[ei];
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const reach = enemy.radius + PLAYER.radius - 3;
        if (dx * dx + dy * dy < reach * reach) {
          const before = state.lives;
          events = hurtPlayer(events);
          if (state.lives < before || player.shieldTimer === 0) {
            state.enemies.splice(ei, 1);
            fx.burst(enemy.x, enemy.y, enemyColor(enemy.kind), 12, 300);
            events |= EV_EXPLODE;
          }
          if (!player.alive) break;
        }
      }
      // Enemy orbs against the player.
      for (let oi = state.orbs.length - 1; oi >= 0; oi -= 1) {
        const orb = state.orbs[oi];
        const dx = orb.x - player.x;
        const dy = orb.y - player.y;
        const reach = ORB.radius + PLAYER.radius - 2;
        if (dx * dx + dy * dy < reach * reach) {
          state.orbs.splice(oi, 1);
          events = hurtPlayer(events);
          if (!player.alive) break;
        }
      }
      // Pickups against the player.
      for (let pi = state.pickups.length - 1; pi >= 0; pi -= 1) {
        const pickup = state.pickups[pi];
        const dx = pickup.x - player.x;
        const dy = pickup.y - player.y;
        const reach = PICKUP.radius + PLAYER.radius + 6;
        if (dx * dx + dy * dy < reach * reach) {
          state.pickups.splice(pi, 1);
          events |= EV_PICKUP;
          if (pickup.kind === 'rapid') {
            player.rapidTimer = PICKUP.rapidTime;
            fx.floater(player.x, player.y - 30, 'RAPID FIRE', '#ffe066');
          } else if (pickup.kind === 'shield') {
            player.shieldTimer = PICKUP.shieldTime;
            fx.floater(player.x, player.y - 30, 'SHIELD UP', '#53f5d2');
          } else if (pickup.kind === 'life') {
            state.lives = Math.min(state.lives + 1, 5);
            fx.floater(player.x, player.y - 30, '+1 HULL', '#7dff6a');
          } else if (pickup.kind === 'bomb') {
            events |= EV_BOMB;
            state.flash = 0.8;
            state.shake = Math.min(state.shake + 12, 20);
            const victims = state.enemies.splice(0, state.enemies.length);
            for (const victim of victims) events = killEnemy(victim, events);
            state.orbs.length = 0;
          }
          fx.ring(player.x, player.y, '#eef2ff');
        }
      }
    }
    return events;
  }

  function step(dt, control) {
    let events = 0;
    state.time += dt;
    state.shake = Math.max(0, state.shake - 60 * dt);
    state.flash = Math.max(0, state.flash - 1.8 * dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.banner) {
      state.banner.t += dt;
      if (state.banner.t > WAVE.bannerTime + 0.6) state.banner = null;
    }

    if (state.phase === 'title') {
      // Ambient drift for the title backdrop: a few drones wander the arena.
      if (state.enemies.length < 6 && random() < dt * 0.7) {
        const kind = random() < 0.5 ? 'chaser' : 'weaver';
        const point = spawnPoint();
        state.enemies.push({
          kind, x: point.x, y: point.y,
          vx: range(random, -60, 60), vy: range(random, -60, 60),
          hp: 1, maxHp: 1, radius: ENEMY[kind].radius, speed: 0,
          angle: random() * TAU, t: range(random, 0, 10), fireTimer: 0, score: 0,
        });
      }
      for (const enemy of state.enemies) {
        enemy.t += dt;
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        enemy.angle += dt * 0.4;
        if (enemy.x < -50) enemy.x = FIELD.width + 50;
        if (enemy.x > FIELD.width + 50) enemy.x = -50;
        if (enemy.y < -50) enemy.y = FIELD.height + 50;
        if (enemy.y > FIELD.height + 50) enemy.y = -50;
      }
      fx.update(dt);
      return events;
    }

    if (state.phase === 'over') {
      state.overTimer += dt;
      for (const enemy of state.enemies) {
        enemy.t += dt;
        enemy.x += enemy.vx * dt * 0.4;
        enemy.y += enemy.vy * dt * 0.4;
        enemy.angle += dt * 0.3;
      }
      fx.update(dt);
      return events;
    }

    // Playing.
    if (state.waveState === 'banner') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) state.waveState = 'active';
    } else if (state.waveState === 'active') {
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          const gap = Math.max(WAVE.minGap, WAVE.spawnGap - (state.wave - 1) * WAVE.gapPerWave);
          state.spawnTimer = gap;
          spawnEnemy(state.spawnQueue.shift());
        }
      } else if (state.enemies.length === 0) {
        const bonus = 100 + state.wave * 25;
        state.score += bonus;
        fx.floater(FIELD.width / 2, FIELD.height / 2 - 60, `WAVE ${state.wave} CLEAR  +${bonus}`, '#7dff6a');
        state.waveState = 'rest';
        state.waveTimer = WAVE.restTime;
      }
    } else if (state.waveState === 'rest') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) {
        startWave(state.wave + 1);
        events |= EV_WAVE;
      }
    }

    events = updatePlayer(dt, control, events);
    events = updateEnemies(dt, events);

    for (let bi = state.bullets.length - 1; bi >= 0; bi -= 1) {
      const bullet = state.bullets[bi];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        state.bullets.splice(bi, 1);
      }
    }
    for (let oi = state.orbs.length - 1; oi >= 0; oi -= 1) {
      const orb = state.orbs[oi];
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      orb.life -= dt;
      if (orb.life <= 0) state.orbs.splice(oi, 1);
    }
    for (let pi = state.pickups.length - 1; pi >= 0; pi -= 1) {
      const pickup = state.pickups[pi];
      pickup.t += dt;
      pickup.life -= dt;
      pickup.x += pickup.vx * dt;
      pickup.y += pickup.vy * dt;
      pickup.vx *= 1 - 2 * dt;
      pickup.vy *= 1 - 2 * dt;
      if (pickup.life <= 0) state.pickups.splice(pi, 1);
    }

    events = collide(events);
    fx.update(dt);
    return events;
  }

  function reset() {
    state.phase = 'title';
    state.score = 0;
    state.lives = PLAYER.lives;
    state.wave = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.kills = 0;
    state.bullets.length = 0;
    state.orbs.length = 0;
    state.enemies.length = 0;
    state.pickups.length = 0;
    state.spawnQueue = [];
    state.waveState = 'idle';
    state.banner = null;
    state.shake = 0;
    state.flash = 0;
    state.player = freshPlayer();
    fx.clear();
  }

  function startRun() {
    reset();
    state.phase = 'playing';
    startWave(1);
  }

  return {
    state,
    fx,
    reset,
    startRun,
    step,
    multiplier,
    get random() {
      return random;
    },
  };
}

export function enemyColor(kind) {
  return {
    chaser: '#ff5d5d',
    weaver: '#c792ff',
    mini: '#ff9f43',
    splitter: '#ff7847',
    shooter: '#4dc9ff',
  }[kind] || '#ffffff';
}
