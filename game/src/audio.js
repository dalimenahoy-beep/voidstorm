// Synthesised sound effects with the Web Audio API: no audio files, every
// sound is an oscillator or a burst of filtered noise shaped by an envelope.
// The context is created lazily on the first user gesture, as browsers ask.

export function createAudio() {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;
  let lastShoot = 0;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return false;
    context = new AudioCtor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    noiseBuffer = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    return true;
  }

  function tone({ freq = 440, end = null, type = 'square', time = 0.12, volume = 0.2, delay = 0 }) {
    if (!ensure()) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (end !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + time);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + time);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + time + 0.02);
  }

  function noise({ time = 0.25, volume = 0.3, freq = 1200, delay = 0 }) {
    if (!ensure()) return;
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, start);
    filter.frequency.exponentialRampToValueAtTime(80, start + time);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + time);
    source.connect(filter).connect(gain).connect(master);
    source.start(start);
    source.stop(start + time + 0.02);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot() {
      const now = performance.now();
      if (now - lastShoot < 45) return;
      lastShoot = now;
      tone({ freq: 880, end: 220, type: 'square', time: 0.07, volume: 0.05 });
    },
    enemyHit() {
      tone({ freq: 300, end: 160, type: 'sawtooth', time: 0.05, volume: 0.06 });
    },
    explode(big = false) {
      noise({ time: big ? 0.45 : 0.22, volume: big ? 0.4 : 0.22, freq: big ? 900 : 1400 });
      tone({ freq: big ? 160 : 220, end: 40, type: 'triangle', time: big ? 0.4 : 0.2, volume: 0.25 });
    },
    hurt() {
      tone({ freq: 200, end: 60, type: 'sawtooth', time: 0.3, volume: 0.3 });
      noise({ time: 0.3, volume: 0.25, freq: 700 });
    },
    dash() {
      noise({ time: 0.14, volume: 0.1, freq: 2600 });
    },
    pickup() {
      tone({ freq: 660, type: 'sine', time: 0.09, volume: 0.18 });
      tone({ freq: 990, type: 'sine', time: 0.14, volume: 0.18, delay: 0.07 });
    },
    bomb() {
      noise({ time: 0.7, volume: 0.45, freq: 500 });
      tone({ freq: 90, end: 30, type: 'sine', time: 0.7, volume: 0.4 });
    },
    wave() {
      tone({ freq: 440, type: 'triangle', time: 0.1, volume: 0.16 });
      tone({ freq: 587, type: 'triangle', time: 0.1, volume: 0.16, delay: 0.09 });
      tone({ freq: 880, type: 'triangle', time: 0.16, volume: 0.16, delay: 0.18 });
    },
    gameOver() {
      tone({ freq: 392, type: 'triangle', time: 0.22, volume: 0.22 });
      tone({ freq: 311, type: 'triangle', time: 0.22, volume: 0.22, delay: 0.2 });
      tone({ freq: 233, type: 'triangle', time: 0.45, volume: 0.24, delay: 0.4 });
    },
    start() {
      tone({ freq: 523, type: 'triangle', time: 0.09, volume: 0.16 });
      tone({ freq: 784, type: 'triangle', time: 0.14, volume: 0.16, delay: 0.08 });
    },
  };
}
