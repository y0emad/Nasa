const noiseBuffer = (ctx, seconds, brown) => {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else {
        data[i] = white;
      }
    }
  }
  return buffer;
};

const distortionCurve = (amount) => {
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
};

export const createLaunchAudio = () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  const ctx = new AudioContextClass();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.ratio.value = 6;
  master.connect(compressor).connect(ctx.destination);

  const rumbleSource = ctx.createBufferSource();
  rumbleSource.buffer = noiseBuffer(ctx, 5, true);
  rumbleSource.loop = true;
  const rumbleFilter = ctx.createBiquadFilter();
  rumbleFilter.type = "lowpass";
  rumbleFilter.frequency.value = 90;
  rumbleFilter.Q.value = 0.8;
  const drive = ctx.createWaveShaper();
  drive.curve = distortionCurve(6);
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0;
  rumbleSource.connect(rumbleFilter).connect(drive).connect(rumbleGain).connect(master);

  const subOsc = ctx.createOscillator();
  subOsc.type = "sine";
  subOsc.frequency.value = 38;
  const subGain = ctx.createGain();
  subGain.gain.value = 0;
  subOsc.connect(subGain).connect(master);

  const crackleSource = ctx.createBufferSource();
  crackleSource.buffer = noiseBuffer(ctx, 3, false);
  crackleSource.loop = true;
  const crackleFilter = ctx.createBiquadFilter();
  crackleFilter.type = "bandpass";
  crackleFilter.frequency.value = 900;
  crackleFilter.Q.value = 0.6;
  const crackleGain = ctx.createGain();
  crackleGain.gain.value = 0;
  crackleSource.connect(crackleFilter).connect(crackleGain).connect(master);

  rumbleSource.start();
  subOsc.start();
  crackleSource.start();

  let thrust = 0;
  let distance = 0;
  let muted = false;

  const crackleTimer = setInterval(() => {
    const level = muted ? 0 : thrust * (1 - distance) * 0.55;
    const pop = Math.pow(Math.random(), 3);
    crackleGain.gain.setTargetAtTime(level * (0.15 + pop), ctx.currentTime, 0.008);
  }, 35);

  const apply = () => {
    const now = ctx.currentTime;
    const level = muted ? 0 : thrust;
    const near = 1 - distance;
    rumbleGain.gain.setTargetAtTime(level * (0.55 + near * 0.6), now, 0.12);
    subGain.gain.setTargetAtTime(level * near * 0.5, now, 0.15);
    rumbleFilter.frequency.setTargetAtTime(70 + level * near * 420, now, 0.2);
    crackleFilter.frequency.setTargetAtTime(500 + near * 900, now, 0.2);
  };

  return {
    resume: () => ctx.state === "suspended" && ctx.resume(),
    setThrust(level, far = 0) {
      thrust = Math.max(0, Math.min(1, level));
      distance = Math.max(0, Math.min(0.92, far));
      apply();
    },
    setMuted(value) {
      muted = value;
      master.gain.setTargetAtTime(value ? 0 : 0.9, ctx.currentTime, 0.05);
      apply();
    },
    beep(frequency = 880, duration = 0.12, volume = 0.18) {
      if (muted) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 2400;
      osc.connect(filter).connect(gain).connect(master);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.02);
    },
    thud(volume = 0.6) {
      if (muted) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
      osc.connect(gain).connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    },
    close() {
      clearInterval(crackleTimer);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      setTimeout(() => ctx.close().catch(() => {}), 500);
    },
  };
};
