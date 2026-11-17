// Everything the player sees: the starfield arena, the ship and drones,
// bullets, pickups, the HUD and the title / pause / game-over screens.
// Draws the world's state and changes none of it.

import { COMBO, FIELD, FONT, PALETTE, PICKUP, PLAYER } from './config.js';
import { createRandom } from './random.js';
import { enemyColor } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'playing';
export const SCREEN_OVER = 'over';

// A fixed starfield: same stars every visit, twinkling on the game clock.
const stars = (() => {
  const random = createRandom(20261115);
  const list = [];
  for (let index = 0; index < 130; index += 1) {
    list.push({
      x: random() * FIELD.width,
      y: random() * FIELD.height,
      r: 0.6 + random() * 1.7,
      phase: random() * Math.PI * 2,
    });
  }
  return list;
})();

/** How the 1280x720 field fits a canvas of any size: scale and letterbox offsets. */
export function computeView(canvas) {
  const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
  return {
    scale,
    offsetX: (canvas.width - FIELD.width * scale) / 2,
    offsetY: (canvas.height - FIELD.height * scale) / 2,
  };
}

function polygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index][0], points[index][1]);
  ctx.closePath();
}

function drawBackdrop(ctx, time) {
  ctx.fillStyle = PALETTE.backdrop;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const glow = ctx.createRadialGradient(640, 360, 60, 640, 360, 720);
  glow.addColorStop(0, 'rgba(38, 48, 120, 0.35)');
  glow.addColorStop(1, 'rgba(5, 6, 15, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 80; x < FIELD.width; x += 80) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FIELD.height);
  }
  for (let y = 80; y < FIELD.height; y += 80) {
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD.width, y);
  }
  ctx.stroke();

  for (const star of stars) {
    const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * 1.7 + star.phase));
    ctx.globalAlpha = twinkle * 0.8;
    ctx.fillStyle = PALETTE.star;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(83, 245, 210, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, FIELD.width - 2, FIELD.height - 2);
}

function drawShip(ctx, player, time) {
  if (!player.alive) return;
  const blink = player.invulnTimer > 0 && Math.floor(time * 12) % 2 === 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  if (blink) ctx.globalAlpha = 0.35;

  const speed = Math.hypot(player.vx, player.vy);
  if (speed > 50) {
    const flame = 12 + 6 * Math.sin(time * 42) + speed * 0.012;
    ctx.fillStyle = 'rgba(255, 160, 66, 0.85)';
    polygon(ctx, [[-12, 5], [-12 - flame, 0], [-12, -5]]);
    ctx.fill();
  }
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 16;
  ctx.fillStyle = PALETTE.player;
  polygon(ctx, [[20, 0], [-10, 11], [-5, 0], [-10, -11]]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.playerCore;
  ctx.beginPath();
  ctx.arc(4, 0, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (player.shieldTimer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.25 * Math.sin(time * 6);
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER.radius + 10 + 2 * Math.sin(time * 6), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemy(ctx, enemy, time) {
  const color = enemyColor(enemy.kind);
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.shadowColor = color;
  ctx.shadowBlur = 13;
  ctx.fillStyle = color;
  const r = enemy.radius;
  if (enemy.kind === 'chaser' || enemy.kind === 'mini') {
    ctx.rotate(enemy.angle);
    polygon(ctx, [[r, 0], [-r * 0.8, r * 0.72], [-r * 0.35, 0], [-r * 0.8, -r * 0.72]]);
    ctx.fill();
  } else if (enemy.kind === 'weaver') {
    ctx.rotate(enemy.t * 2.4);
    polygon(ctx, [[r, 0], [0, r * 0.62], [-r, 0], [0, -r * 0.62]]);
    ctx.fill();
  } else if (enemy.kind === 'splitter') {
    ctx.rotate(enemy.angle);
    const points = [];
    for (let index = 0; index < 6; index += 1) {
      const a = (index / 6) * Math.PI * 2;
      points.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    polygon(ctx, points);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
    const inner = [];
    for (let index = 0; index < 6; index += 1) {
      const a = (index / 6) * Math.PI * 2 + 0.4;
      inner.push([Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52]);
    }
    polygon(ctx, inner);
    ctx.fill();
  } else if (enemy.kind === 'shooter') {
    ctx.rotate(enemy.angle);
    ctx.fillRect(-r, -r * 0.72, r * 2, r * 1.44);
    ctx.fillRect(r * 0.4, -3.5, r * 0.95, 7);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#eaf7ff';
    ctx.beginPath();
    ctx.arc(0, 0, 5.4 + Math.sin(time * 5 + enemy.t) * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (enemy.maxHp > 2 && enemy.hp < enemy.maxHp) {
    const width = enemy.radius * 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 11, width, 3.6);
    ctx.fillStyle = color;
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 11, width * (enemy.hp / enemy.maxHp), 3.6);
  }
}

function drawPickup(ctx, pickup, time) {
  if (pickup.life < 2.2 && Math.floor(time * 7) % 2 === 0) return; // expiring: blink out
  const colors = {
    rapid: PALETTE.pickupRapid,
    shield: PALETTE.pickupShield,
    bomb: PALETTE.pickupBomb,
    life: PALETTE.pickupLife,
  };
  const glyphs = { rapid: 'R', shield: 'S', bomb: 'B', life: '+' };
  const color = colors[pickup.kind];
  const bob = Math.sin(time * 3.4 + pickup.t * 2) * 3;
  ctx.save();
  ctx.translate(pickup.x, pickup.y + bob);
  ctx.rotate(Math.PI / 4 + Math.sin(time * 2 + pickup.t) * 0.18);
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(5, 6, 15, 0.85)';
  const r = PICKUP.radius;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(-r, -r, r * 2, r * 2);
  ctx.rotate(-(Math.PI / 4 + Math.sin(time * 2 + pickup.t) * 0.18));
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.font = `800 17px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyphs[pickup.kind], 0, 1);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawHud(ctx, state, ui) {
  const player = state.player;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', 26, 34);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(String(state.score).padStart(6, '0'), 24, 66);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(`BEST ${Math.max(ui.best, state.score)}`, 26, 88);

  if (state.combo > 1) {
    const mult = Math.min(1 + state.combo * 0.2, 3);
    ctx.fillStyle = PALETTE.bullet;
    ctx.font = `800 19px ${FONT}`;
    ctx.fillText(`COMBO x${mult.toFixed(1)}`, 26, 118);
    ctx.fillStyle = 'rgba(255, 224, 102, 0.25)';
    ctx.fillRect(26, 126, 110, 5);
    ctx.fillStyle = PALETTE.bullet;
    ctx.fillRect(26, 126, 110 * Math.max(0, state.comboTimer / COMBO.window), 5);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText('WAVE', FIELD.width / 2, 34);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(String(Math.max(1, state.wave)), FIELD.width / 2, 66);
  const remaining = state.spawnQueue.length + state.enemies.length;
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(remaining > 0 ? `${remaining} HOSTILES` : 'SECTOR CLEAR', FIELD.width / 2, 88);

  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText('HULL', FIELD.width - 26, 34);
  for (let index = 0; index < state.lives; index += 1) {
    const x = FIELD.width - 40 - index * 26;
    ctx.fillStyle = PALETTE.player;
    ctx.save();
    ctx.translate(x, 56);
    polygon(ctx, [[10, 0], [-7, 7], [-3, 0], [-7, -7]]);
    ctx.fill();
    ctx.restore();
  }

  // Dash charge and power-up timers, bottom-left.
  const dashReady = player.dashCooldown <= 0;
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('DASH [SHIFT]', 26, FIELD.height - 44);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(26, FIELD.height - 36, 110, 6);
  ctx.fillStyle = dashReady ? PALETTE.player : PALETTE.muted;
  ctx.fillRect(26, FIELD.height - 36, 110 * (dashReady ? 1 : 1 - player.dashCooldown / PLAYER.dashCooldown), 6);

  let timerY = FIELD.height - 66;
  if (player.rapidTimer > 0) {
    ctx.fillStyle = PALETTE.pickupRapid;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(`RAPID FIRE ${player.rapidTimer.toFixed(0)}s`, 26, timerY);
    timerY -= 20;
  }
  if (player.shieldTimer > 0) {
    ctx.fillStyle = PALETTE.pickupShield;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(`SHIELD ${player.shieldTimer.toFixed(0)}s`, 26, timerY);
    timerY -= 20;
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText(ui.muted ? 'SOUND OFF [M]' : 'SOUND ON [M]', FIELD.width - 26, FIELD.height - 20);
  ctx.fillText('PAUSE [P]', FIELD.width - 26, FIELD.height - 40);
}

function panel(ctx, width, height) {
  const x = (FIELD.width - width) / 2;
  const y = (FIELD.height - height) / 2;
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 14);
  ctx.fill();
  ctx.stroke();
  return { x, y };
}

function drawTitle(ctx, state, ui, time) {
  ctx.fillStyle = 'rgba(3, 4, 12, 0.45)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 34;
  ctx.fillStyle = PALETTE.player;
  ctx.font = `900 108px ${FONT}`;
  ctx.fillText('VOIDSTORM', FIELD.width / 2, 238);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 25px ${FONT}`;
  ctx.fillText('N E O N   A R E N A   D E F E N S E', FIELD.width / 2, 282);

  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 19px ${FONT}`;
  ctx.fillText('Drone swarms are breaching the void. You are the last interceptor.', FIELD.width / 2, 348);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 19px ${FONT}`;
  ctx.fillText('WASD / ARROWS — fly        MOUSE — aim        CLICK / SPACE — fire        SHIFT — dash', FIELD.width / 2, 402);
  ctx.fillText('Chain kills to raise your combo. Catch drops: R rapid fire · S shield · B bomb · + hull', FIELD.width / 2, 434);

  if (Math.floor(time * 1.6) % 2 === 0) {
    ctx.fillStyle = PALETTE.bullet;
    ctx.font = `800 26px ${FONT}`;
    ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', FIELD.width / 2, 516);
  }
  if (ui.best > 0) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText(`BEST SCORE ${ui.best}`, FIELD.width / 2, 566);
  }
}

function drawOver(ctx, state, ui) {
  ctx.fillStyle = 'rgba(3, 4, 12, 0.5)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  panel(ctx, 520, 380);
  ctx.textAlign = 'center';
  ctx.shadowColor = PALETTE.danger;
  ctx.shadowBlur = 24;
  ctx.fillStyle = PALETTE.danger;
  ctx.font = `900 62px ${FONT}`;
  ctx.fillText('SHIP DOWN', FIELD.width / 2, 268);
  ctx.shadowBlur = 0;

  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText('FINAL SCORE', FIELD.width / 2, 322);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText(String(state.score), FIELD.width / 2, 368);
  if (ui.isBest && state.score > 0) {
    ctx.fillStyle = PALETTE.bullet;
    ctx.font = `800 18px ${FONT}`;
    ctx.fillText('★ NEW BEST ★', FIELD.width / 2, 398);
  }
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText(`Waves survived: ${state.wave}        Drones downed: ${state.kills}`, FIELD.width / 2, 440);
  if (state.overTimer > 0.7) {
    ctx.fillStyle = PALETTE.bullet;
    ctx.font = `800 21px ${FONT}`;
    ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', FIELD.width / 2, 500);
  }
}

function drawBanner(ctx, state) {
  const banner = state.banner;
  if (!banner) return;
  const fadeIn = Math.min(1, banner.t / 0.25);
  const fadeOut = Math.min(1, Math.max(0, (2.8 - banner.t) / 0.5));
  ctx.save();
  ctx.globalAlpha = Math.min(fadeIn, fadeOut);
  ctx.textAlign = 'center';
  ctx.shadowColor = PALETTE.panelEdge;
  ctx.shadowBlur = 26;
  ctx.fillStyle = PALETTE.text;
  ctx.font = `900 64px ${FONT}`;
  ctx.fillText(banner.text, FIELD.width / 2, 300);
  ctx.shadowBlur = 0;
  if (banner.sub) {
    ctx.fillStyle = PALETTE.bullet;
    ctx.font = `700 21px ${FONT}`;
    ctx.fillText(banner.sub, FIELD.width / 2, 342);
  }
  ctx.restore();
}

/** Draw the whole frame: backdrop, entities, particles, HUD and screens. */
export function drawGame(ctx, world, ui) {
  const state = world.state;
  const time = state.time;
  drawBackdrop(ctx, time);

  for (const pickup of state.pickups) drawPickup(ctx, pickup, time);
  for (const enemy of state.enemies) drawEnemy(ctx, enemy, time);

  ctx.save();
  ctx.shadowColor = PALETTE.orb;
  ctx.shadowBlur = 10;
  ctx.fillStyle = PALETTE.orb;
  for (const orb of state.orbs) {
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, 6 + Math.sin(time * 9 + orb.x) * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // The title screen carries no ship: it would sit on the tagline's text.
  if (state.phase !== 'title') drawShip(ctx, state.player, time);

  ctx.save();
  ctx.shadowColor = PALETTE.bullet;
  ctx.shadowBlur = 9;
  ctx.fillStyle = PALETTE.bullet;
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  world.fx.draw(ctx);

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 240, 220, ${state.flash * 0.28})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  if (state.phase === 'playing' || state.phase === 'over') drawHud(ctx, state, ui);
  if (state.phase === 'playing') drawBanner(ctx, state);
  if (state.phase === 'title') drawTitle(ctx, state, ui, time);
  if (state.phase === 'over') drawOver(ctx, state, ui);
  if (ui.paused) {
    ctx.fillStyle = 'rgba(3, 4, 12, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `900 54px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, 350);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 19px ${FONT}`;
    ctx.fillText('Press P to resume', FIELD.width / 2, 392);
  }
}
