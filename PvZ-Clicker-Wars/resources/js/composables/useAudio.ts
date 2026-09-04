import { ref, onUnmounted } from 'vue';

type SfxName =
  | 'attack'
  | 'wallHit'
  | 'wallDestroy'
  | 'shopBuy'
  | 'death'
  | 'teleport'
  | 'turretHit'
  | 'shopOpen'
  | 'save';

interface AudioNodes {
  masterGain: GainNode;
  musicGain: GainNode;
  sfxGain: GainNode;
  analyser: AnalyserNode;
  freqData: Uint8Array;
}

function loadNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw !== null) {
    const n = parseFloat(raw);
    if (!isNaN(n) && n >= 0 && n <= 1) return n;
  }
  return fallback;
}

function loadBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

export function useAudio() {
  const musicVolume = ref(loadNumber('pvz2_music_volume', 0.4));
  const sfxVolume = ref(loadNumber('pvz2_sfx_volume', 0.5));
  const musicMuted = ref(loadBool('pvz2_music_muted', false));
  const sfxMuted = ref(loadBool('pvz2_sfx_muted', false));
  const isPlaying = ref(false);

  let ctx: AudioContext | null = null;
  let nodes: AudioNodes | null = null;
  let musicNodes: OscillatorNode[] = [];
  let noiseNode: AudioBufferSourceNode | null = null;
  let musicInterval: number | null = null;
  let initialized = false;

  function ensureContext(): AudioContext {
    if (!ctx || ctx.state === 'closed') {
      ctx = new AudioContext();
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  function ensureNodes(): AudioNodes {
    const audio = ensureContext();
    if (!nodes) {
      const analyser = audio.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.connect(audio.destination);

      const masterGain = audio.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(analyser);

      const musicGain = audio.createGain();
      musicGain.gain.value = musicMuted.value ? 0 : musicVolume.value;
      musicGain.connect(masterGain);

      const sfxGain = audio.createGain();
      sfxGain.gain.value = sfxMuted.value ? 0 : sfxVolume.value;
      sfxGain.connect(masterGain);

      nodes = { masterGain, musicGain, sfxGain, analyser, freqData };
    }
    return nodes;
  }

  // ─── Procedural Duke 3D-Style Industrial Music ────────────────────
  // ~130 BPM, 4/4 kick-snare, distorted bass, synth stabs

  const BPM = 130;
  const BEAT = 60 / BPM; // ~0.4615s per beat
  const STEP = BEAT / 2;  // 8th note ~0.2308s
  let beatTimer: number | null = null;
  let currentStep = 0;
  let songCtx: AudioContext | null = null;
  let songDest: GainNode | null = null;

  function createNoiseBuffer(audio: AudioContext, duration: number): AudioBuffer {
    const sampleRate = audio.sampleRate;
    const length = sampleRate * duration;
    const buffer = audio.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function playKick(audio: AudioContext, dest: GainNode, time: number) {
    const osc = audio.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.12);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.5, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    osc.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  function playSnare(audio: AudioContext, dest: GainNode, time: number) {
    const buf = createNoiseBuffer(audio, 0.15);
    const noise = audio.createBufferSource();
    noise.buffer = buf;
    const filter = audio.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    const g = audio.createGain();
    g.gain.setValueAtTime(0.22, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    noise.connect(filter);
    filter.connect(g);
    g.connect(dest);
    noise.start(time);
    noise.stop(time + 0.15);

    const body = audio.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(200, time);
    body.frequency.exponentialRampToValueAtTime(100, time + 0.05);
    const g2 = audio.createGain();
    g2.gain.setValueAtTime(0.15, time);
    g2.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    body.connect(g2);
    g2.connect(dest);
    body.start(time);
    body.stop(time + 0.1);
  }

  function playHiHat(audio: AudioContext, dest: GainNode, time: number, open: boolean) {
    const buf = createNoiseBuffer(audio, open ? 0.1 : 0.04);
    const noise = audio.createBufferSource();
    noise.buffer = buf;
    const filter = audio.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const g = audio.createGain();
    const dur = open ? 0.1 : 0.03;
    const vol = open ? 0.08 : 0.05;
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    noise.connect(filter);
    filter.connect(g);
    g.connect(dest);
    noise.start(time);
    noise.stop(time + dur + 0.01);
  }

  function playBass(audio: AudioContext, dest: GainNode, time: number, freq: number, dur: number) {
    const osc = audio.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const dist = audio.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = (Math.PI + 3) * x / (Math.PI + 3 * Math.abs(x));
    }
    dist.curve = curve;
    dist.oversample = '2x';
    osc.connect(dist);
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, time);
    filter.frequency.exponentialRampToValueAtTime(200, time + dur);
    filter.Q.value = 5;
    const g = audio.createGain();
    g.gain.setValueAtTime(0.18, time);
    g.gain.setValueAtTime(0.18, time + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    dist.connect(filter);
    filter.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  // Patterns (16 steps = 2 bars of 8th notes)
  // Main loop (E minor):
  //   Kick:    x . . . x . . . x . . . x . x .
  //   Snare:   . . . . x . . . . . . . x . . .
  //   HiHat:   x . x . x . x . x . x . x . x x
  //   Bass:    E2 E2 . E2  E2 . E2 E2  E2 . E2 .  G2 . A2 B2
  //
  // Breakdown: same drums, 3rd bass variation (E minor arpeggio)
  //   Kick:    x . . . x . . . x . . . x . x .   (same as main)
  //   Snare:   . . . . x . . . . . . . x . . .   (same as main)
  //   HiHat:   x . x . x . x . x . x . x . x 2   (same as main)
  //   Bass:    E2 . B2 . G2 . A2 . B2 . A2 . G2 . E2 . B2 E2

  const bassPattern = [
    82.41, 82.41, 0, 82.41,
    82.41, 0, 82.41, 82.41,
    82.41, 0, 82.41, 0,
    98.00, 0, 110.00, 123.47,
  ];

  const bassPattern2 = [
    82.41, 82.41, 0, 98.00,
    82.41, 0, 110.00, 82.41,
    73.42, 73.42, 0, 73.42,
    82.41, 0, 82.41, 0,
  ];

  const bassPattern3 = [
    82.41, 0, 123.47, 0,
    98.00, 0, 110.00, 0,
    123.47, 0, 110.00, 0,
    98.00, 0, 123.47, 82.41,
  ];

  const kickPattern = [
    1, 0, 0, 0, 1, 0, 0, 0,
    1, 0, 0, 0, 1, 0, 1, 0,
  ];

  const snarePattern = [
    0, 0, 0, 0, 1, 0, 0, 0,
    0, 0, 0, 0, 1, 0, 0, 0,
  ];

  const hhPattern = [
    1, 0, 1, 0, 1, 0, 1, 0,
    1, 0, 1, 0, 1, 0, 1, 2,
  ]; // 1=closed, 2=open

  // Song structure state machine
  let mainLoopsPlayed = 0;
  let breakdownLoopsPlayed = 0;
  let isBreakdown = false;
  let breakdownTargetLoops = 1;

  function schedulerTick() {
    if (!songCtx || !songDest || musicMuted.value) return;

    const audio = songCtx;
    const dest = songDest;
    const scheduleStep = currentStep % 16;
    const time = audio.currentTime + 0.05;

    // Same drums always
    if (kickPattern[scheduleStep]) {
      playKick(audio, dest, time);
    }
    if (snarePattern[scheduleStep]) {
      playSnare(audio, dest, time);
    }
    if (hhPattern[scheduleStep] === 1) {
      playHiHat(audio, dest, time, false);
    } else if (hhPattern[scheduleStep] === 2) {
      playHiHat(audio, dest, time, true);
    }

    // Bass: main alternates pattern1/pattern2, breakdown uses pattern3
    let bassLine: number[];
    if (isBreakdown) {
      bassLine = bassPattern3;
    } else {
      const songBar = Math.floor(currentStep / 16) % 2;
      bassLine = songBar === 0 ? bassPattern : bassPattern2;
    }
    const bassFreq = bassLine[scheduleStep];
    if (bassFreq > 0) {
      playBass(audio, dest, time, bassFreq, STEP * 0.9);
    }

    currentStep++;

    // Bar boundary (16 steps) → update song structure
    if (currentStep % 16 === 0) {
      if (isBreakdown) {
        breakdownLoopsPlayed++;
        if (breakdownLoopsPlayed >= breakdownTargetLoops) {
          // Back to main
          isBreakdown = false;
          mainLoopsPlayed = 0;
          breakdownLoopsPlayed = 0;
        }
      } else {
        mainLoopsPlayed++;
        if (mainLoopsPlayed >= 3) {
          // Enter breakdown for 1-2 loops
          isBreakdown = true;
          breakdownTargetLoops = Math.random() < 0.5 ? 1 : 2;
          mainLoopsPlayed = 0;
          breakdownLoopsPlayed = 0;
        }
      }
    }
  }

  function startMusic() {
    if (isPlaying.value) return;
    const audio = ensureContext();
    const { musicGain } = ensureNodes();

    songCtx = audio;
    songDest = musicGain;
    currentStep = 0;

    beatTimer = window.setInterval(schedulerTick, STEP * 1000 * 0.5);
    isPlaying.value = true;
  }

  function stopMusic() {
    if (beatTimer) {
      clearInterval(beatTimer);
      beatTimer = null;
    }
    musicNodes.forEach((osc) => {
      try { osc.stop(); } catch { /* already stopped */ }
    });
    musicNodes = [];

    if (noiseNode) {
      try { noiseNode.stop(); } catch { /* already stopped */ }
      noiseNode = null;
    }

    if (musicInterval) {
      clearInterval(musicInterval);
      musicInterval = null;
    }

    songCtx = null;
    songDest = null;
    isPlaying.value = false;
  }

  // ─── Sound Effects ────────────────────────────────────────────────

  function playSfx(name: SfxName) {
    if (sfxMuted.value) return;
    const audio = ensureContext();
    const { sfxGain } = ensureNodes();
    const now = audio.currentTime;

    switch (name) {
      case 'attack': {
        // Energy blade slash — noise-whoosh with low thwack, NO laser sweep
        // Layer 1: Fast noise whoosh (the blade cutting air)
        const buf = createNoiseBuffer(audio, 0.1);
        const noise = audio.createBufferSource();
        noise.buffer = buf;
        const nFilter = audio.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.setValueAtTime(3000, now);
        nFilter.frequency.exponentialRampToValueAtTime(800, now + 0.08);
        nFilter.Q.value = 1.5;
        const ng = audio.createGain();
        ng.gain.setValueAtTime(0, now);
        ng.gain.linearRampToValueAtTime(0.18, now + 0.008);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        noise.connect(nFilter);
        nFilter.connect(ng);
        ng.connect(sfxGain);
        noise.start(now);
        noise.stop(now + 0.1);

        // Layer 2: Low transient thwack (blade impact feel)
        const osc = audio.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.05);
        const g = audio.createGain();
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(g);
        g.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.08);

        // Layer 3: Tiny electrical plasma crackle
        const buf2 = createNoiseBuffer(audio, 0.04);
        const crackle = audio.createBufferSource();
        crackle.buffer = buf2;
        const cFilter = audio.createBiquadFilter();
        cFilter.type = 'highpass';
        cFilter.frequency.value = 5000;
        const cg = audio.createGain();
        cg.gain.setValueAtTime(0.03, now);
        cg.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        crackle.connect(cFilter);
        cFilter.connect(cg);
        cg.connect(sfxGain);
        crackle.start(now);
        crackle.stop(now + 0.05);
        break;
      }
      case 'wallHit': {
        // Protoss shield impact — energy crackle + low thud
        const osc = audio.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.06);
        const shieldFilter = audio.createBiquadFilter();
        shieldFilter.type = 'bandpass';
        shieldFilter.frequency.value = 800;
        shieldFilter.Q.value = 3;
        const g = audio.createGain();
        g.gain.setValueAtTime(0.1, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(shieldFilter);
        shieldFilter.connect(g);
        g.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.1);

        // Energy crackle burst
        const buf = createNoiseBuffer(audio, 0.06);
        const noise = audio.createBufferSource();
        noise.buffer = buf;
        const nFilter = audio.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.value = 2500;
        nFilter.Q.value = 4;
        const ng = audio.createGain();
        ng.gain.setValueAtTime(0.06, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        noise.connect(nFilter);
        nFilter.connect(ng);
        ng.connect(sfxGain);
        noise.start(now);
        noise.stop(now + 0.07);

        // Low thud
        const sub = audio.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(100, now);
        sub.frequency.exponentialRampToValueAtTime(40, now + 0.06);
        const sg = audio.createGain();
        sg.gain.setValueAtTime(0.08, now);
        sg.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        sub.connect(sg);
        sg.connect(sfxGain);
        sub.start(now);
        sub.stop(now + 0.1);
        break;
      }
      case 'wallDestroy': {
        const buffer = createNoiseBuffer(audio, 0.6);
        const noise = audio.createBufferSource();
        noise.buffer = buffer;
        const filter = audio.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.5);
        const g = audio.createGain();
        g.gain.setValueAtTime(0.2, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        noise.connect(filter);
        filter.connect(g);
        g.connect(sfxGain);
        noise.start(now);
        noise.stop(now + 0.6);

        const osc = audio.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
        const g2 = audio.createGain();
        g2.gain.setValueAtTime(0.15, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(g2);
        g2.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
      }
      case 'shopBuy': {
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = audio.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const g = audio.createGain();
          g.gain.setValueAtTime(0, now + i * 0.08);
          g.gain.linearRampToValueAtTime(0.1, now + i * 0.08 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);
          osc.connect(g);
          g.connect(sfxGain);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.35);
        });
        break;
      }
      case 'death': {
        const osc = audio.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 1.2);
        const filter = audio.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600;
        const g = audio.createGain();
        g.gain.setValueAtTime(0.18, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(filter);
        filter.connect(g);
        g.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 1.3);

        const sub = audio.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = 40;
        const g2 = audio.createGain();
        g2.gain.setValueAtTime(0.15, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
        sub.connect(g2);
        g2.connect(sfxGain);
        sub.start(now);
        sub.stop(now + 1.1);
        break;
      }
      case 'teleport': {
        const osc = audio.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(2000, now + 0.2);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.6);
        const filter = audio.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1000;
        filter.Q.value = 2;
        const g = audio.createGain();
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(filter);
        filter.connect(g);
        g.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.7);

        const sh = audio.createOscillator();
        sh.type = 'triangle';
        sh.frequency.value = 1200;
        const g2 = audio.createGain();
        g2.gain.setValueAtTime(0, now);
        g2.gain.linearRampToValueAtTime(0.06, now + 0.1);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        sh.connect(g2);
        g2.connect(sfxGain);
        sh.start(now);
        sh.stop(now + 0.5);
        break;
      }
      case 'turretHit': {
        // Rocket launcher whoosh — 25% louder
        const osc = audio.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
        const rocketFilter = audio.createBiquadFilter();
        rocketFilter.type = 'lowpass';
        rocketFilter.frequency.value = 400;
        rocketFilter.Q.value = 2;
        const g = audio.createGain();
        g.gain.setValueAtTime(0.05, now);
        g.gain.linearRampToValueAtTime(0.063, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(rocketFilter);
        rocketFilter.connect(g);
        g.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.2);

        // Distant thud impact
        const thud = audio.createOscillator();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(120, now + 0.05);
        thud.frequency.exponentialRampToValueAtTime(30, now + 0.12);
        const tg = audio.createGain();
        tg.gain.setValueAtTime(0, now);
        tg.gain.setValueAtTime(0.038, now + 0.05);
        tg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        thud.connect(tg);
        tg.connect(sfxGain);
        thud.start(now + 0.05);
        thud.stop(now + 0.18);

        // Exhaust noise
        const buf = createNoiseBuffer(audio, 0.12);
        const noise = audio.createBufferSource();
        noise.buffer = buf;
        const nFilter = audio.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.value = 600;
        nFilter.Q.value = 1;
        const ng = audio.createGain();
        ng.gain.setValueAtTime(0.031, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        noise.connect(nFilter);
        nFilter.connect(ng);
        ng.connect(sfxGain);
        noise.start(now);
        noise.stop(now + 0.13);
        break;
      }
      case 'shopOpen': {
        [440, 554.37].forEach((freq, i) => {
          const osc = audio.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const g = audio.createGain();
          g.gain.setValueAtTime(0, now + i * 0.1);
          g.gain.linearRampToValueAtTime(0.08, now + i * 0.1 + 0.03);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
          osc.connect(g);
          g.connect(sfxGain);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.3);
        });
        break;
      }
      case 'save': {
        const osc = audio.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 880;
        const g = audio.createGain();
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(g);
        g.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.18);
        break;
      }
    }
  }

  // ─── Volume / Mute Controls ──────────────────────────────────────

  function setMusicVolume(v: number) {
    musicVolume.value = Math.max(0, Math.min(1, v));
    localStorage.setItem('pvz2_music_volume', String(musicVolume.value));
    if (nodes && !musicMuted.value) {
      nodes.musicGain.gain.setValueAtTime(musicVolume.value, ctx?.currentTime ?? 0);
    }
  }

  function setSfxVolume(v: number) {
    sfxVolume.value = Math.max(0, Math.min(1, v));
    localStorage.setItem('pvz2_sfx_volume', String(sfxVolume.value));
    if (nodes && !sfxMuted.value) {
      nodes.sfxGain.gain.setValueAtTime(sfxVolume.value, ctx?.currentTime ?? 0);
    }
  }

  function toggleMusicMute() {
    musicMuted.value = !musicMuted.value;
    localStorage.setItem('pvz2_music_muted', String(musicMuted.value));
    if (!musicMuted.value) {
      ensureContext();
      ensureNodes();
      nodes!.musicGain.gain.setValueAtTime(musicVolume.value, ctx?.currentTime ?? 0);
      if (!isPlaying.value) {
        startMusic();
      }
    } else {
      if (nodes) {
        nodes.musicGain.gain.setValueAtTime(0, ctx?.currentTime ?? 0);
      }
    }
  }

  function toggleSfxMute() {
    sfxMuted.value = !sfxMuted.value;
    localStorage.setItem('pvz2_sfx_muted', String(sfxMuted.value));
    if (nodes) {
      nodes.sfxGain.gain.setValueAtTime(
        sfxMuted.value ? 0 : sfxVolume.value,
        ctx?.currentTime ?? 0
      );
    }
  }

  function initOnInteraction() {
    if (initialized) return;
    initialized = true;
    ensureContext();
    ensureNodes();
    if (!musicMuted.value) {
      startMusic();
    }
  }

  onUnmounted(() => {
    stopMusic();
    if (ctx && ctx.state !== 'closed') {
      ctx.close();
    }
  });

  function getFrequencyData(): Uint8Array | null {
    if (!nodes || musicMuted.value) return null;
    nodes.analyser.getByteFrequencyData(nodes.freqData);
    return nodes.freqData;
  }

  return {
    musicVolume,
    sfxVolume,
    musicMuted,
    sfxMuted,
    isPlaying,
    startMusic,
    stopMusic,
    playSfx,
    setMusicVolume,
    setSfxVolume,
    toggleMusicMute,
    toggleSfxMute,
    initOnInteraction,
    getFrequencyData,
  };
}
