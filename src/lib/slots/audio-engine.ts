import type { WinTier } from "@/lib/slots/demo-engine";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export class SlotAudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private spinGain: GainNode | null = null;
  private spinOscillators: OscillatorNode[] = [];
  private spinLfo: OscillatorNode | null = null;
  private spinLfoGain: GainNode | null = null;
  private musicIntervalId: number | null = null;
  private muted = false;
  private disposed = false;

  private ensureContext() {
    if (this.context || this.disposed) {
      return;
    }

    const context = new AudioContext();
    const masterGain = context.createGain();
    masterGain.gain.value = 0.35;
    masterGain.connect(context.destination);

    this.context = context;
    this.masterGain = masterGain;
  }

  async unlock() {
    this.ensureContext();
    if (!this.context) {
      return;
    }

    if (this.context.state !== "running") {
      await this.context.resume();
    }
  }

  setMuted(nextMuted: boolean) {
    this.muted = nextMuted;
    if (this.masterGain) {
      this.masterGain.gain.value = nextMuted ? 0 : 0.35;
    }
  }

  private playTone(input: {
    frequency: number;
    duration: number;
    type?: OscillatorType;
    gain?: number;
    delay?: number;
  }) {
    if (this.muted) {
      return;
    }

    this.ensureContext();
    if (!this.context || !this.masterGain) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime + (input.delay ?? 0);
    const attack = 0.01;
    const release = Math.max(0.05, input.duration * 0.7);

    oscillator.type = input.type ?? "triangle";
    oscillator.frequency.setValueAtTime(input.frequency, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(input.gain ?? 0.12, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + release);

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(now + input.duration);
  }

  private playNoise(duration = 0.08, gainAmount = 0.08) {
    if (this.muted) {
      return;
    }

    this.ensureContext();
    if (!this.context || !this.masterGain) {
      return;
    }

    const sampleRate = this.context.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.context.createBuffer(1, frameCount, sampleRate);
    const channel = buffer.getChannelData(0);

    for (let index = 0; index < frameCount; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const filter = this.context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1200;

    const gain = this.context.createGain();
    gain.gain.value = gainAmount;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start();
    source.stop(this.context.currentTime + duration);
  }

  playButton() {
    this.playTone({ frequency: 540, duration: 0.1, type: "square", gain: 0.06 });
    this.playTone({ frequency: 760, duration: 0.11, type: "triangle", gain: 0.05, delay: 0.04 });
  }

  startSpinLoop() {
    if (this.muted) {
      return;
    }

    this.ensureContext();
    if (!this.context || !this.masterGain || this.spinGain) {
      return;
    }

    const spinGain = this.context.createGain();
    spinGain.gain.value = 0;

    const toneFilter = this.context.createBiquadFilter();
    toneFilter.type = "bandpass";
    toneFilter.frequency.value = 620;
    toneFilter.Q.value = 0.8;

    const oscA = this.context.createOscillator();
    oscA.type = "triangle";
    oscA.frequency.value = 240;

    const oscB = this.context.createOscillator();
    oscB.type = "sine";
    oscB.frequency.value = 320;

    const lfo = this.context.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 4.6;

    const lfoGain = this.context.createGain();
    lfoGain.gain.value = 14;

    lfo.connect(lfoGain);
    lfoGain.connect(oscA.frequency);
    lfoGain.connect(oscB.frequency);

    oscA.connect(toneFilter);
    oscB.connect(toneFilter);
    toneFilter.connect(spinGain);
    spinGain.connect(this.masterGain);

    const now = this.context.currentTime;
    spinGain.gain.linearRampToValueAtTime(0.055, now + 0.12);

    oscA.start(now);
    oscB.start(now);
    lfo.start(now);

    this.spinGain = spinGain;
    this.spinOscillators = [oscA, oscB];
    this.spinLfo = lfo;
    this.spinLfoGain = lfoGain;
  }

  stopSpinLoop() {
    if (!this.context || !this.spinGain) {
      return;
    }

    const now = this.context.currentTime;
    this.spinGain.gain.cancelScheduledValues(now);
    this.spinGain.gain.linearRampToValueAtTime(0.0001, now + 0.18);

    this.spinOscillators.forEach((oscillator) => {
      oscillator.stop(now + 0.2);
      oscillator.disconnect();
    });

    this.spinLfo?.stop(now + 0.2);
    this.spinLfo?.disconnect();
    this.spinLfoGain?.disconnect();

    this.spinGain.disconnect();
    this.spinGain = null;
    this.spinOscillators = [];
    this.spinLfo = null;
    this.spinLfoGain = null;
  }

  playReelStop(reelIndex: number) {
    const base = 190 + reelIndex * 42;
    this.playTone({ frequency: base, duration: 0.11, type: "triangle", gain: 0.11 });
    this.playTone({ frequency: base * 1.65, duration: 0.08, type: "sine", gain: 0.06, delay: 0.05 });
    this.playNoise(0.05, 0.035);
  }

  playWin(tier: WinTier) {
    if (tier === "none") {
      return;
    }

    const patternByTier: Record<Exclude<WinTier, "none">, number[]> = {
      small: [440, 554, 659],
      big: [392, 494, 587, 784, 988],
      mega: [392, 523, 659, 784, 1046, 1318],
    };

    const gain = tier === "small" ? 0.09 : tier === "big" ? 0.14 : 0.18;
    const duration = tier === "small" ? 0.2 : 0.26;

    patternByTier[tier].forEach((frequency, index) => {
      this.playTone({
        frequency,
        duration,
        type: tier === "mega" ? "sawtooth" : "triangle",
        gain: clamp(gain - index * 0.01, 0.06, 0.2),
        delay: index * 0.08,
      });
    });

    if (tier !== "small") {
      this.playNoise(tier === "mega" ? 0.18 : 0.12, tier === "mega" ? 0.06 : 0.04);
    }
  }

  startMusic() {
    if (this.musicIntervalId !== null || this.muted) {
      return;
    }

    this.ensureContext();
    if (!this.context) {
      return;
    }

    const chordSets = [
      [130.81, 164.81, 220],
      [146.83, 185, 246.94],
      [155.56, 196, 261.63],
      [174.61, 220, 293.66],
    ];

    let pointer = 0;
    const scheduleChord = () => {
      const chord = chordSets[pointer % chordSets.length];
      chord.forEach((frequency, index) => {
        this.playTone({
          frequency,
          duration: 1.2,
          type: "sine",
          gain: 0.018,
          delay: index * 0.03,
        });
      });

      pointer += 1;
    };

    scheduleChord();
    this.musicIntervalId = window.setInterval(scheduleChord, 1400);
  }

  stopMusic() {
    if (this.musicIntervalId !== null) {
      window.clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
  }

  destroy() {
    if (this.disposed) {
      return;
    }

    this.stopSpinLoop();
    this.stopMusic();

    if (this.context) {
      void this.context.close();
    }

    this.context = null;
    this.masterGain = null;
    this.disposed = true;
  }
}
