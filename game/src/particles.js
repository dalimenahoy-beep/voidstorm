// The particle system: sparks, explosion shards, engine trails and floating
// score text. One pooled list, updated and drawn here; the world asks for
// bursts and this file owns how they look and fade.

import { range } from './random.js';

const MAX_PARTICLES = 420;

export function createParticles(random) {
  const list = [];

  function add(particle) {
    if (list.length >= MAX_PARTICLES) list.shift();
    list.push(particle);
  }

  return {
    list,

    burst(x, y, color, count = 14, speed = 320, life = 0.55, size = 3) {
      for (let index = 0; index < count; index += 1) {
        const angle = random() * Math.PI * 2;
        const velocity = range(random, speed * 0.25, speed);
        add({
          kind: 'spark',
          x, y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life: range(random, life * 0.5, life),
          age: 0,
          size: range(random, size * 0.5, size * 1.4),
          color,
        });
      }
    },

    ring(x, y, color) {
      add({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.35, age: 0, size: 6, color });
    },

    trail(x, y, color) {
      add({
        kind: 'spark',
        x: x + range(random, -3, 3),
        y: y + range(random, -3, 3),
        vx: range(random, -24, 24),
        vy: range(random, -24, 24),
        life: range(random, 0.18, 0.34),
        age: 0,
        size: range(random, 2, 4.4),
        color,
      });
    },

    floater(x, y, text, color) {
      add({ kind: 'text', x, y, vx: 0, vy: -56, life: 0.9, age: 0, size: 17, color, text });
    },

    update(dt) {
      for (let index = list.length - 1; index >= 0; index -= 1) {
        const particle = list[index];
        particle.age += dt;
        if (particle.age >= particle.life) {
          list.splice(index, 1);
          continue;
        }
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        if (particle.kind === 'spark') {
          particle.vx *= 1 - 3.2 * dt;
          particle.vy *= 1 - 3.2 * dt;
        }
        if (particle.kind === 'ring') particle.size += 340 * dt;
      }
    },

    draw(ctx) {
      for (const particle of list) {
        const fade = 1 - particle.age / particle.life;
        if (particle.kind === 'ring') {
          ctx.globalAlpha = fade * 0.8;
          ctx.strokeStyle = particle.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.stroke();
        } else if (particle.kind === 'text') {
          ctx.globalAlpha = Math.min(1, fade * 1.6);
          ctx.fillStyle = particle.color;
          ctx.font = `700 ${particle.size}px "Segoe UI", system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(particle.text, particle.x, particle.y);
        } else {
          ctx.globalAlpha = fade;
          ctx.fillStyle = particle.color;
          ctx.fillRect(
            particle.x - particle.size / 2,
            particle.y - particle.size / 2,
            particle.size,
            particle.size,
          );
        }
      }
      ctx.globalAlpha = 1;
    },

    clear() {
      list.length = 0;
    },
  };
}
