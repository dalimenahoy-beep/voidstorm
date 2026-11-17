// Voidstorm tuning: every number and colour the game runs on, in one place.
// The arena is a fixed 1280x720 logical field; the renderer scales it to the
// window, so no rule below depends on the player's screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second at any refresh rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  accel: 2600,
  maxSpeed: 340,
  drag: 6.5,
  fireInterval: 0.16,
  rapidInterval: 0.075,
  bulletSpeed: 780,
  dashSpeed: 1150,
  dashTime: 0.16,
  dashCooldown: 1.6,
  invulnerable: 2.0,
  lives: 3,
};

export const BULLET = { radius: 4, life: 0.9 };
export const ORB = { radius: 6, speed: 235, life: 4.5 };

/** Enemy kinds: hit points, speed, radius, score and touch damage per kind. */
export const ENEMY = {
  chaser:  { hp: 2, speed: 118, radius: 16, score: 50 },
  weaver:  { hp: 2, speed: 132, radius: 15, score: 70 },
  mini:    { hp: 1, speed: 196, radius: 10, score: 30 },
  splitter:{ hp: 6, speed: 62,  radius: 27, score: 120 },
  shooter: { hp: 3, speed: 88,  radius: 17, score: 100 },
};

/** Waves: a spawn budget that grows, a spawn gap that shrinks, a speed creep. */
export const WAVE = {
  baseCount: 6,
  countPerWave: 3,
  spawnGap: 0.85,
  gapPerWave: 0.045,
  minGap: 0.3,
  speedPerWave: 0.035,
  hpBonusEvery: 4,
  bannerTime: 2.2,
  restTime: 1.4,
};

export const PICKUP = {
  radius: 12,
  life: 9,
  dropChance: 0.16,
  lifeChance: 0.05,
  rapidTime: 8,
  shieldTime: 7,
};

/** Combo: each kill inside the window raises the multiplier, up to the cap. */
export const COMBO = { window: 3.0, max: 8 };

export const PALETTE = {
  backdrop: '#05060f',
  star: '#aab6ff',
  grid: 'rgba(64, 84, 190, 0.16)',
  player: '#53f5d2',
  playerCore: '#eafffa',
  bullet: '#ffe066',
  orb: '#ff5d8f',
  chaser: '#ff5d5d',
  weaver: '#c792ff',
  mini: '#ff9f43',
  splitter: '#ff7847',
  shooter: '#4dc9ff',
  pickupRapid: '#ffe066',
  pickupShield: '#53f5d2',
  pickupBomb: '#ff5d8f',
  pickupLife: '#7dff6a',
  panel: 'rgba(10, 14, 34, 0.82)',
  panelEdge: '#3d5afe',
  text: '#eef2ff',
  muted: '#8b96c9',
  danger: '#ff5d5d',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'voidstorm.best';
