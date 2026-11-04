/**
 * Procedural Web Audio Sound Synthesizer for AOT ODM Traversal Engine
 * 100% procedural sound synthesis using Web Audio API oscillators, noise buffers, and filters.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.gasNode = null;
    this.reelNode = null;
    this.windNode = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initContinuousLoops();
    } catch (e) {
      console.warn('Web Audio initialization failed:', e);
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.7, this.ctx.currentTime);
    }
  }

  // Create a buffer of white noise
  createNoiseBuffer(seconds = 2.0) {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  initContinuousLoops() {
    if (!this.ctx) return;

    // 1. Gas Thruster continuous hiss loop
    const gasBuffer = this.createNoiseBuffer(2.0);
    if (gasBuffer) {
      const gasSource = this.ctx.createBufferSource();
      gasSource.buffer = gasBuffer;
      gasSource.loop = true;

      const gasFilter = this.ctx.createBiquadFilter();
      gasFilter.type = 'bandpass';
      gasFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      gasFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      const gasGain = this.ctx.createGain();
      gasGain.gain.setValueAtTime(0, this.ctx.currentTime);

      gasSource.connect(gasFilter);
      gasFilter.connect(gasGain);
      gasGain.connect(this.masterGain);
      gasSource.start();

      this.gasNode = { gain: gasGain, filter: gasFilter };
    }

    // 2. Wire Reel-in hum loop
    const reelOsc = this.ctx.createOscillator();
    reelOsc.type = 'sawtooth';
    reelOsc.frequency.setValueAtTime(420, this.ctx.currentTime);

    const reelFilter = this.ctx.createBiquadFilter();
    reelFilter.type = 'lowpass';
    reelFilter.frequency.setValueAtTime(900, this.ctx.currentTime);

    const reelGain = this.ctx.createGain();
    reelGain.gain.setValueAtTime(0, this.ctx.currentTime);

    reelOsc.connect(reelFilter);
    reelFilter.connect(reelGain);
    reelGain.connect(this.masterGain);
    reelOsc.start();

    this.reelNode = { osc: reelOsc, gain: reelGain, filter: reelFilter };

    // 3. High-speed wind rush loop
    const windBuffer = this.createNoiseBuffer(2.0);
    if (windBuffer) {
      const windSource = this.ctx.createBufferSource();
      windSource.buffer = windBuffer;
      windSource.loop = true;

      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.setValueAtTime(400, this.ctx.currentTime);

      const windGain = this.ctx.createGain();
      windGain.gain.setValueAtTime(0, this.ctx.currentTime);

      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(this.masterGain);
      windSource.start();

      this.windNode = { gain: windGain, filter: windFilter };
    }
  }

  // Update continuous sounds based on game state
  updateContinuous({ isBoosting, isReeling, speedKmh }) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Gas thrusters
    if (this.gasNode) {
      const targetGasGain = isBoosting ? 0.35 : 0;
      this.gasNode.gain.gain.setTargetAtTime(targetGasGain, now, 0.05);
    }

    // Reeling spool sound
    if (this.reelNode) {
      const targetReelGain = isReeling ? 0.22 : 0;
      this.reelNode.gain.gain.setTargetAtTime(targetReelGain, now, 0.05);
      if (isReeling) {
        const freq = 380 + (speedKmh * 3.5);
        this.reelNode.osc.frequency.setTargetAtTime(Math.min(freq, 850), now, 0.08);
      }
    }

    // High speed wind sound
    if (this.windNode) {
      const windIntensity = Math.max(0, (speedKmh - 30) / 70); // starts above 30km/h
      const clampedIntensity = Math.min(windIntensity, 1.0);
      this.windNode.gain.gain.setTargetAtTime(clampedIntensity * 0.25, now, 0.1);
      this.windNode.filter.frequency.setTargetAtTime(300 + clampedIntensity * 1500, now, 0.1);
    }
  }

  // Hook wire launch ping (Q / E)
  playHookLaunch() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High-pitched wire whoosh and trigger click
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(2200, now + 0.08);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Anchor embed impact into brick or wood
  playAnchorImpact() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Lethal Nape Slice: High speed flesh cut + steel resonance + sonic snap
  playNapeSlash(speedKmh = 50) {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 1. Steel blade ping
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1800 + Math.min(speedKmh * 10, 800), now);
    osc1.frequency.exponentialRampToValueAtTime(600, now + 0.25);

    gain1.gain.setValueAtTime(0.5, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // 2. Heavy flesh crunch / slice
    const noise = this.ctx.createBufferSource();
    const noiseBuffer = this.createNoiseBuffer(0.3);
    if (noiseBuffer) {
      noise.buffer = noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(250, now + 0.3);

      const gain2 = this.ctx.createGain();
      gain2.gain.setValueAtTime(0.6, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      noise.connect(filter);
      filter.connect(gain2);
      gain2.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.4);
    }
  }

  // Non-lethal Ricochet / blade bounce
  playRicochet() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Titan heavy footstep thud
  playTitanFootstep(distance = 30) {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const vol = Math.max(0.05, Math.min(0.6, 1.0 - (distance / 90)));
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(75, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.3);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Titan Roar
  playTitanRoar() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.linearRampToValueAtTime(190, now + 0.4);
    osc.frequency.exponentialRampToValueAtTime(70, now + 1.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 1.3);
  }

  // Titan Death Steam Hiss
  playSteamSizzle() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    const noiseBuffer = this.createNoiseBuffer(2.5);
    if (noiseBuffer) {
      noise.buffer = noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1200, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 2.6);
    }
  }

  // High-velocity impact damage against wall or ground
  playImpactCrash() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  // Blade reload click / gas tank swap
  playReload() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Metallic latch click
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1500, now);
    osc.frequency.setValueAtTime(800, now + 0.05);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // QTE struggle blade strike
  playQTEHit() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.1);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }
}

export const soundEngine = new SoundEngine();
