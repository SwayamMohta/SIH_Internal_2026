// Web Audio API procedural sound synthesizer for physical newspaper tactility

let audioCtx: AudioContext | null = null;
let isMuted = true; // Default muted for respectful UX

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const audioService = {
  getIsMuted(): boolean {
    return isMuted;
  },

  setMuted(muted: boolean): void {
    isMuted = muted;
    if (!muted) {
      getAudioContext();
      this.playPaperRustle();
    }
  },

  toggleMute(): boolean {
    this.setMuted(!isMuted);
    return isMuted;
  },

  // Synthesize paper fluttering/rustling sound
  playPaperRustle(): void {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);

      // Filtered pink noise for paper friction
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2) * 0.08 * (1 - i / bufferSize);
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      filter.Q.value = 1.2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start();
    } catch {
      // Audio context catch-all
    }
  },

  // Linotype mechanical letterpress keystroke
  playLinotypeKey(): void {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800 + Math.random() * 400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Audio context catch-all
    }
  },

  // Heavy rubber/wood ink stamp impact
  playStampThud(isApproved = true): void {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);

      // Add high-frequency ink slap
      this.playPaperRustle();

      if (isApproved) {
        setTimeout(() => {
          if (!ctx) return;
          const chime = ctx.createOscillator();
          const chimeGain = ctx.createGain();
          chime.type = 'sine';
          chime.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          chime.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5
          chimeGain.gain.setValueAtTime(0.1, ctx.currentTime);
          chimeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          chime.connect(chimeGain);
          chimeGain.connect(ctx.destination);
          chime.start();
          chime.stop(ctx.currentTime + 0.45);
        }, 80);
      }
    } catch {
      // Audio context catch-all
    }
  }
};
