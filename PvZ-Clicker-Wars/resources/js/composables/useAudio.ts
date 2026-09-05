import { ref, computed, onUnmounted } from 'vue';

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
  musicCompressor: DynamicsCompressorNode;
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

      // Glue compressor so layered procedural drums/bass hit like a production mix
      const musicCompressor = audio.createDynamicsCompressor();
      musicCompressor.threshold.value = -18;
      musicCompressor.knee.value = 14;
      musicCompressor.ratio.value = 8;
      musicCompressor.attack.value = 0.003;
      musicCompressor.release.value = 0.22;
      musicGain.connect(musicCompressor);
      musicCompressor.connect(masterGain);

      const sfxGain = audio.createGain();
      sfxGain.gain.value = sfxMuted.value ? 0 : sfxVolume.value;
      sfxGain.connect(masterGain);

      nodes = { masterGain, musicGain, musicCompressor, sfxGain, analyser, freqData };
    }
    return nodes;
  }

  // ─── Procedural Multi-Track Music Engine ──────────────────────────
  // 5 selectable procedural tracks (Web Audio, no assets):
  //   Industrial  — Duke3D-style industrial (E minor, 140 BPM)
  //   Fatality    — Mortal Kombat-inspired dark tribal (A riff, 132 BPM)
  //   Rip & Tear  — Doom-inspired aggro riffing (F minor, 180 BPM)
  //   Void Prism  — eerie Protoss void ambience (A minor, 102 BPM)
  //   Hell March  — Red Alert 2 Klepacki march (D Phrygian, 124 BPM)
  //   Iron March  — Hell March essence overdriven (150 BPM, neuro bass, 2:11)
  // Each track is an 8th-note step-sequencer that follows either a fixed
  // timeline (track.timeline) or a random section rotation.
  // Iron March uses the timeline + neuro wobble bass; the rest keep doing
  // the original random section rotation.

  const NOTE = {
    D1: 36.71, E1: 41.20, F1: 43.65, G1: 49.00,
    A1: 55.00, Bb1: 58.27, B1: 61.74,
    C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00,
    A2: 110.00, Bb2: 116.54, B2: 123.47, C3: 130.81, Db3: 138.59,
    D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, G3: 196.00,
  };

  // Shared drum pattern flavours used across tracks
  const KICK_FULL = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0];
  const KICK_MK = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0];
  const KICK_GHOST = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  const KICK_RISE = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 1];
  const KICK_BLAST = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

  interface TrackDrums {
    kick: { start: number; end: number; dur: number; gain: number; type: OscillatorType };
    snare: { noiseGain: number; filter: number; bodyGain: number; bodyStart: number; bodyEnd: number };
    hh: { closedGain: number; openGain: number };
    rattle: { gain: number; filter: number };
  }

  interface TrackBass {
    gain: number;
    fStart: number;
    fEnd: number;
    q: number;
  }

  interface TrackNeuro {
    gain: number;
    fStart: number;
    fEnd: number;
    q: number;
    detune: number;
    lfoDepth: number;
    lfoRate: number;
  }

  interface TrackStab {
    gain: number;
    fStart: number;
    fEnd: number;
    q: number;
    type: OscillatorType;
    dur: number;
    detune?: number;
    vibrato?: number;
    filter?: BiquadFilterType;
  }

  interface TrackChug {
    gain: number;
    fStart: number;
    fEnd: number;
    q: number;
    type: OscillatorType;
    dur: number;
  }

  interface TrackTom {
    gain: number;
    sweep: number;
    ring: number;
  }

  interface TrackCrash {
    gain: number;
  }

  interface TrackSection {
    kick: number[];
    bassA: number[];
    bassB: number[];
    stab?: number[];
    chug?: number[];
    tom?: number[];
    crash?: number[];
    roll?: number[];
  }

  interface TrackDef {
    id: string;
    name: string;
    emoji: string;
    bpm: number;
    swing?: number;
    jitter?: number;
    mainSection: number;
    mainLoops: number;
    altLoops: { min: number; max: number };
    drums: TrackDrums;
    bass: TrackBass;
    neuBass?: TrackNeuro;
    stab: TrackStab;
    chug: TrackChug;
    tom: TrackTom;
    crash: TrackCrash;
    sections: TrackSection[];
    timeline?: { section: number; loops: number }[];
  }

  let beatTimer: number | null = null;
  let currentStep = 0;
  let currentSectionIdx = 0;
  let sectionStepsLeft = 1;
  let songCtx: AudioContext | null = null;
  let songDest: GainNode | null = null;
  let timelinePos = 0;

  function loadTrackIndex(): number {
    const raw = localStorage.getItem('pvz2_music_track');
    if (raw !== null) {
      const n = parseInt(raw, 10);
      if (!isNaN(n) && n >= 0 && n < TRACKS.length) return n;
    }
    return 0;
  }

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

  function playKick(audio: AudioContext, dest: GainNode, time: number, k: TrackDrums['kick']) {
    // Sub body
    const osc = audio.createOscillator();
    osc.type = k.type;
    osc.frequency.setValueAtTime(k.start, time);
    osc.frequency.exponentialRampToValueAtTime(k.end, time + k.dur);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(k.gain, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, time + k.dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + k.dur + 0.05);

    // Beater click — instant attack transient ("the POW")
    const click = audio.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(5000, time);
    click.frequency.exponentialRampToValueAtTime(500, time + 0.02);
    const cg = audio.createGain();
    cg.gain.setValueAtTime(0.0001, time);
    cg.gain.linearRampToValueAtTime(k.gain * 0.14, time + 0.002);
    cg.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    click.connect(cg);
    cg.connect(dest);
    click.start(time);
    click.stop(time + 0.045);
  }

  function playSnare(audio: AudioContext, dest: GainNode, time: number, s: TrackDrums['snare']) {
    const buf = createNoiseBuffer(audio, 0.15);
    const noise = audio.createBufferSource();
    noise.buffer = buf;
    const filter = audio.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = s.filter;
    const g = audio.createGain();
    g.gain.setValueAtTime(s.noiseGain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    noise.connect(filter);
    filter.connect(g);
    g.connect(dest);
    noise.start(time);
    noise.stop(time + 0.15);

    const body = audio.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(s.bodyStart, time);
    body.frequency.exponentialRampToValueAtTime(s.bodyEnd, time + 0.05);
    const g2 = audio.createGain();
    g2.gain.setValueAtTime(s.bodyGain, time);
    g2.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    body.connect(g2);
    g2.connect(dest);
    body.start(time);
    body.stop(time + 0.1);
  }

  function playHiHat(audio: AudioContext, dest: GainNode, time: number, open: boolean, h: TrackDrums['hh']) {
    const buf = createNoiseBuffer(audio, open ? 0.1 : 0.04);
    const noise = audio.createBufferSource();
    noise.buffer = buf;
    const filter = audio.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const g = audio.createGain();
    const dur = open ? 0.1 : 0.03;
    const vol = open ? h.openGain : h.closedGain;
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    noise.connect(filter);
    filter.connect(g);
    g.connect(dest);
    noise.start(time);
    noise.stop(time + dur + 0.01);
  }

  // "Rattle" — mechanical war-ratchet tick: the infamous Hell March industrial chatter
  // that grinds under the whole mix like a spinning chainsaw gear.
  function playRattle(audio: AudioContext, dest: GainNode, time: number, r: TrackDrums['rattle']) {
    const buf = createNoiseBuffer(audio, 0.045);
    const noise = audio.createBufferSource();
    noise.buffer = buf;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = r.filter;
    filter.Q.value = 2;
    const g = audio.createGain();
    // Organic velocity: each ratchet tick lands at slightly different force
    const gMul = 0.75 + Math.random() * 0.5;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(r.gain * gMul, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    noise.connect(filter);
    filter.connect(g);
    g.connect(dest);
    noise.start(time);
    noise.stop(time + 0.045);
  }

  function playBass(audio: AudioContext, dest: GainNode, time: number, freq: number, dur: number, b: TrackBass) {
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
    filter.frequency.setValueAtTime(b.fStart, time);
    filter.frequency.exponentialRampToValueAtTime(b.fEnd, time + dur);
    filter.Q.value = b.q;
    const g = audio.createGain();
    g.gain.setValueAtTime(b.gain, time);
    g.gain.setValueAtTime(b.gain, time + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    dist.connect(filter);
    filter.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  // "Neuro bass" voice — tempo-synced wobble supersaw for active dubstep basslines:
  // 3 detuned saws → distortion → lowpass whose cutoff is wobbled by an LFO at
  // 16th-note pace, so even a single 8th-note pumps like a machine.
  function playNeuroBass(audio: AudioContext, dest: GainNode, time: number, freq: number, dur: number, n: TrackNeuro, bpm: number) {
    const sawCount = 3;
    const saws: OscillatorNode[] = [];
    const dist = audio.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = (Math.PI + 5) * x / (Math.PI + 5 * Math.abs(x));
    }
    dist.curve = curve;
    dist.oversample = '2x';

    const mix = audio.createGain();
    mix.gain.value = 1 / sawCount;
    for (let i = 0; i < sawCount; i++) {
      const osc = audio.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = Math.round((i - (sawCount - 1) / 2) * n.detune);
      osc.connect(mix);
      saws.push(osc);
    }
    mix.connect(dist);

    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(30, n.fStart), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, n.fEnd), time + dur);
    filter.Q.value = n.q;
    const lfo = audio.createOscillator();
    lfo.type = 'sine';
    const lfoRate = n.lfoRate > 0 ? n.lfoRate : bpm / 60 * 4;
    lfo.frequency.value = lfoRate;
    const lfoGain = audio.createGain();
    lfoGain.gain.value = n.lfoDepth;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const g = audio.createGain();
    g.gain.setValueAtTime(n.gain, time);
    g.gain.setValueAtTime(n.gain, time + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    dist.connect(filter);
    filter.connect(g);
    g.connect(dest);

    saws.forEach((osc) => {
      osc.start(time);
      osc.stop(time + dur + 0.02);
    });
    lfo.start(time);
    lfo.stop(time + dur + 0.02);
  }

  // "Stab" voice — chant/lead (Mortal Kombat chant, Doom riff stabs): sub-octave doubled, driven, present
  function playStab(audio: AudioContext, dest: GainNode, time: number, freq: number, s: TrackStab) {
    const osc = audio.createOscillator();
    osc.type = s.type;
    osc.frequency.value = freq;
    osc.detune.value = s.detune ?? 0;
    const osc2 = audio.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = freq / 2;
    osc2.detune.value = (s.detune ?? 0) * -1.2;
    const vibDepth = s.vibrato ?? 0.015;
    const lfo = audio.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 6;
    const lfoGain = audio.createGain();
    lfoGain.gain.value = freq * vibDepth;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const dist = audio.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = (Math.PI + 4) * x / (Math.PI + 4 * Math.abs(x));
    }
    dist.curve = curve;
    dist.oversample = '2x';
    const filter = audio.createBiquadFilter();
    filter.type = s.filter ?? 'bandpass';
    filter.frequency.setValueAtTime(s.fStart, time);
    filter.frequency.exponentialRampToValueAtTime(s.fEnd, time + s.dur);
    filter.Q.value = s.q;
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(s.gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + s.dur);
    osc.connect(dist);
    dist.connect(filter);
    osc2.connect(filter);
    filter.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + s.dur + 0.02);
    osc2.start(time);
    osc2.stop(time + s.dur + 0.02);
    lfo.start(time);
    lfo.stop(time + s.dur + 0.02);
  }

  // "Chug" voice — heavy palm-muted stab (Doom djent chugs, MK sub-booms)
  function playChug(audio: AudioContext, dest: GainNode, time: number, freq: number, c: TrackChug) {
    const osc = audio.createOscillator();
    osc.type = c.type;
    osc.frequency.value = freq;
    const dist = audio.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = (Math.PI + 4) * x / (Math.PI + 4 * Math.abs(x));
    }
    dist.curve = curve;
    dist.oversample = '2x';
    osc.connect(dist);
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(c.fStart, time);
    filter.frequency.exponentialRampToValueAtTime(c.fEnd, time + c.dur);
    filter.Q.value = c.q;
    const g = audio.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(c.gain, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, time + c.dur);
    dist.connect(filter);
    filter.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + c.dur + 0.01);
  }

  // "Tom" voice — tribal taiko hits (Mortal Kombat drive): pitch-dropping triangle with bandpassed body
  function playTom(audio: AudioContext, dest: GainNode, time: number, freq: number, t: TrackTom) {
    const osc = audio.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, time + t.sweep);
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq * 2.5;
    filter.Q.value = 1.1;
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(t.gain, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, time + t.ring);
    osc.connect(filter);
    filter.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + t.ring + 0.02);
  }

  // "Crash" voice — big noise cymbal hit for section impact
  function playCrash(audio: AudioContext, dest: GainNode, time: number, c: TrackCrash) {
    const buf = createNoiseBuffer(audio, 0.9);
    const noise = audio.createBufferSource();
    noise.buffer = buf;
    const filter = audio.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(c.gain, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.7);
    noise.connect(filter);
    filter.connect(g);
    g.connect(dest);
    noise.start(time);
    noise.stop(time + 0.75);
  }

  // ── Fatality (Mortal Kombat) — the iconic A-riff + G/F pedals ────
  // The famous MK bass riff (per the "100% correct" bass tab): the run on
  // A string 0-0-3-0-5-0-7-5 = A A C A D A E D, then the pedal bit on low
  // G (E-string 3) and F (E-string 1). Chant = the MORTAL-KOMBAT call.
  // A1=55 C2=65.41 D2=73.42 E2=82.41 F2=87.31 G1=49 F1=43.65
  const fatA0 = [55.00, 55.00, 65.41, 55.00, 73.42, 55.00, 82.41, 73.42, 55.00, 55.00, 65.41, 55.00, 73.42, 55.00, 82.41, 110.00];
  const fatB0 = [49.00, 49.00, 49.00, 49.00, 82.41, 87.31, 98.00, 87.31, 43.65, 43.65, 43.65, 43.65, 82.41, 87.31, 98.00, 87.31];
  const fatA1 = [55.00, 0, 55.00, 0, 73.42, 0, 82.41, 0, 55.00, 0, 65.41, 0, 73.42, 0, 110.00, 0];
  const fatB1 = [49.00, 0, 49.00, 0, 49.00, 0, 82.41, 0, 43.65, 0, 43.65, 0, 43.65, 0, 87.31, 0];
  const fatA2 = [55.00, 55.00, 65.41, 55.00, 73.42, 73.42, 82.41, 73.42, 55.00, 55.00, 65.41, 55.00, 73.42, 73.42, 82.41, 82.41];
  const fatB2 = [49.00, 49.00, 49.00, 49.00, 82.41, 87.31, 98.00, 87.31, 43.65, 43.65, 43.65, 43.65, 82.41, 87.31, 98.00, 87.31];
  const fatA3 = [55.00, 55.00, 55.00, 55.00, 65.41, 65.41, 65.41, 65.41, 73.42, 73.42, 73.42, 73.42, 82.41, 82.41, 82.41, 82.41];
  const fatB3 = [98.00, 98.00, 98.00, 98.00, 110.00, 110.00, 110.00, 110.00, 123.47, 123.47, 110.00, 98.00, 82.41, 82.41, 82.41, 82.41];
  // "MORTAL KOMBAT!" chant — call/answer with octave leaps in the heavy
  const mkSta0 = [146.83, 146.83, 146.83, 0, 146.83, 146.83, 146.83, 0, 146.83, 146.83, 146.83, 0, 146.83, 146.83, 146.83, 0];
  const mkSta1 = [130.81, 0, 130.81, 0, 146.83, 0, 146.83, 0, 164.81, 0, 164.81, 0, 146.83, 130.81, 0, 0];
  const mkSta2 = [146.83, 146.83, 220.00, 0, 130.81, 130.81, 196.00, 0, 155.56, 155.56, 233.08, 0, 155.56, 146.83, 130.81, 0];
  const mkSta3 = [146.83, 146.83, 146.83, 146.83, 155.56, 155.56, 155.56, 155.56, 164.81, 164.81, 164.81, 164.81, 174.61, 174.61, 146.83, 174.61];
  // Tribal sub-boom doubling the kick
  const mkChg0 = [36.71, 0, 0, 0, 36.71, 0, 0, 0, 36.71, 0, 0, 0, 36.71, 0, 36.71, 0];
  const mkChg1 = [36.71, 0, 0, 0, 0, 0, 36.71, 0, 36.71, 0, 0, 0, 36.71, 0, 36.71, 0];
  const mkChg2 = [36.71, 0, 36.71, 36.71, 36.71, 0, 36.71, 36.71, 36.71, 0, 36.71, 36.71, 36.71, 0, 36.71, 0];
  const mkChg3 = [36.71, 36.71, 36.71, 0, 36.71, 36.71, 36.71, 0, 36.71, 36.71, 36.71, 0, 36.71, 36.71, 36.71, 36.71];

  // ── Rip & Tear (Doom, F minor) drop-pedal grind / chromatic riff ──
  // F minor drop-grind: the low-F chug pedal with the semitone crawl on
  // top (F-F#-G-Ab) — Mick Gordon's signature tension. The pedal drops an
  // octave to F1 for the brutal heft. F2=87.31 F#2=92.50 G2=98 Ab2=103.83
  const rstA0 = [87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 43.65, 0, 43.65, 0];
  const rstB0 = [87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 92.50, 98.00, 103.83, 87.31];
  const rstA1 = [87.31, 0, 87.31, 0, 87.31, 0, 87.31, 0, 98.00, 0, 103.83, 0, 98.00, 0, 87.31, 43.65];
  const rstB1 = [87.31, 87.31, 0, 87.31, 87.31, 87.31, 0, 87.31, 87.31, 87.31, 0, 87.31, 98.00, 0, 103.83, 87.31];
  const rstA2 = [87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 43.65, 43.65, 43.65, 87.31];
  const rstB2 = [87.31, 87.31, 87.31, 87.31, 98.00, 98.00, 98.00, 98.00, 103.83, 103.83, 103.83, 103.83, 87.31, 87.31, 87.31, 87.31];
  const rstA3 = [87.31, 87.31, 87.31, 87.31, 98.00, 98.00, 98.00, 98.00, 103.83, 103.83, 103.83, 103.83, 110.00, 110.00, 110.00, 110.00];
  const rstB3 = [116.54, 0, 110.00, 0, 103.83, 0, 98.00, 92.50, 87.31, 87.31, 0, 87.31, 98.00, 0, 103.83, 87.31];
  // Palm-muted djent chug motor — offbeats grind, the rise becomes the machine
  const rstChg0 = [0, 87.31, 0, 87.31, 0, 87.31, 0, 87.31, 0, 87.31, 0, 87.31, 0, 87.31, 0, 87.31];
  const rstChg1 = [87.31, 0, 87.31, 0, 87.31, 0, 0, 87.31, 98.00, 0, 103.83, 0, 98.00, 0, 87.31, 0];
  const rstChg2 = [43.65, 43.65, 0, 43.65, 43.65, 43.65, 0, 43.65, 43.65, 43.65, 0, 43.65, 0, 43.65, 43.65, 0];
  const rstChg3 = [43.65, 0, 43.65, 0, 43.65, 0, 43.65, 0, 43.65, 0, 43.65, 0, 43.65, 0, 43.65, 0];
  // The chromatic riff stabs (F3 / F#3 / G3 / Ab3) — the doom snarl
  const rstSta0 = [0, 174.61, 0, 0, 0, 174.61, 0, 0, 0, 174.61, 0, 0, 0, 174.61, 0, 174.61];
  const rstSta1 = [0, 0, 0, 174.61, 0, 0, 0, 185.00, 0, 0, 0, 196.00, 0, 0, 0, 174.61];
  const rstSta2 = [0, 174.61, 0, 174.61, 0, 185.00, 0, 185.00, 0, 196.00, 0, 196.00, 0, 174.61, 0, 0];
  const rstSta3 = [174.61, 0, 174.61, 0, 185.00, 0, 185.00, 0, 196.00, 0, 196.00, 0, 207.65, 0, 196.00, 0];
  // Tribal taiko toms (Mortal Kombat)
  const mkTom0 = [110.00, 0, 0, 0, 130.81, 0, 0, 0, 110.00, 0, 98.00, 0, 130.81, 0, 146.83, 0];
  const mkTom1 = [98.00, 0, 98.00, 0, 98.00, 0, 98.00, 0, 110.00, 0, 110.00, 0, 130.81, 0, 146.83, 0];
  const mkTom2 = [110.00, 0, 130.81, 0, 110.00, 0, 98.00, 0, 130.81, 0, 146.83, 0, 130.81, 0, 110.00, 0];
  const mkTom3 = [98.00, 0, 98.00, 0, 110.00, 0, 110.00, 0, 130.81, 0, 130.81, 0, 146.83, 0, 155.56, 0];
  // Crash hits on bar heads / pre-fill
  const mkCsh0 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0];
  const mkCsh1 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const mkCsh2 = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  const mkCsh3 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0];
  // Doom crash + sparse power toms
  const rstCsh0 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0];
  const rstCsh1 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const rstCsh2 = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  const rstCsh3 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0];
  const rstTom0 = [0, 0, 0, 0, 98.00, 0, 0, 0, 0, 0, 0, 0, 110.00, 0, 0, 0];
  const rstTom2 = [98.00, 0, 0, 0, 0, 0, 110.00, 0, 98.00, 0, 0, 0, 130.81, 0, 0, 0];
  const rstTom3 = [98.00, 0, 0, 0, 0, 0, 110.00, 0, 130.81, 0, 0, 0, 146.83, 0, 130.81, 0];
  // Chainsaw ratchet rises — idle, idle, idle, MACHINE
  const rstRoll0 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const rstRoll1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const rstRoll2 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
  const rstRoll3 = [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2];

  // ── Void Prism (A minor) bass lines ──────────────────────────────
  const vdA0 = [110.00, 0, 110.00, 0, 130.81, 0, 110.00, 110.00, 110.00, 0, 146.83, 0, 155.56, 0, 146.83, 110.00];
  const vdB0 = [110.00, 110.00, 0, 110.00, 164.81, 0, 146.83, 130.81, 110.00, 110.00, 0, 110.00, 123.47, 0, 164.81, 110.00];
  const vdA1 = [110.00, 0, 123.47, 0, 130.81, 0, 123.47, 110.00, 110.00, 0, 155.56, 0, 146.83, 0, 130.81, 110.00];
  const vdB1 = [164.81, 0, 130.81, 0, 146.83, 0, 130.81, 110.00, 164.81, 0, 146.83, 0, 123.47, 0, 130.81, 110.00];
  const vdA2 = [110.00, 110.00, 0, 110.00, 110.00, 0, 110.00, 110.00, 130.81, 130.81, 0, 130.81, 155.56, 0, 146.83, 110.00];
  const vdB2 = [110.00, 110.00, 0, 164.81, 110.00, 0, 164.81, 110.00, 110.00, 110.00, 0, 146.83, 130.81, 0, 123.47, 110.00];
  const vdA3 = [110.00, 110.00, 0, 110.00, 130.81, 130.81, 0, 130.81, 146.83, 146.83, 0, 146.83, 164.81, 164.81, 0, 123.47];
  const vdB3 = [164.81, 0, 146.83, 130.81, 146.83, 0, 130.81, 110.00, 110.00, 110.00, 0, 110.00, 123.47, 0, 130.81, 110.00];
  // Soft protoss pad chimes drifting over the heavier void sections
  const vdSta2 = [220.00, 0, 0, 0, 0, 0, 246.94, 0, 220.00, 0, 0, 0, 0, 0, 261.63, 0];
  const vdSta3 = [220.00, 0, 246.94, 0, 220.00, 0, 196.00, 0, 220.00, 0, 220.00, 0, 261.63, 0, 0, 0];

  // ── Hell March (Red Alert 2, D Phrygian dominant) ─────────────────
  // Straight from Klepacki's tab (drop-D, triplet feel): the low-D power
  // chord stomp D-D-Eb-D-D-F#-D-D plus the crawl F-F#-G. Bass carries the
  // tab roots, stab stacks their fifths for power-chord mass, chugs are
  // palm-muted ghost strokes on the swung offbeats.
  // D2=73.42 Eb2=77.78 F2=87.31 F#2=92.50 G2=98.00
  const hmKick0 = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  const hmKick1 = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
  const hmKick2 = [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1];
  const hmKick3 = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 1];
  const hmA0 = [73.42, 0, 73.42, 0, 77.78, 0, 73.42, 0, 73.42, 0, 92.50, 0, 73.42, 0, 73.42, 0];
  const hmB0 = [73.42, 0, 73.42, 0, 77.78, 0, 73.42, 0, 73.42, 0, 92.50, 0, 87.31, 92.50, 98.00, 0];
  const hmA1 = [73.42, 0, 0, 0, 0, 0, 73.42, 0, 0, 0, 0, 0, 73.42, 0, 0, 0];
  const hmB1 = [73.42, 0, 0, 0, 0, 0, 0, 0, 73.42, 0, 73.42, 0, 0, 0, 73.42, 0];
  const hmA2 = [73.42, 73.42, 0, 0, 77.78, 0, 73.42, 0, 73.42, 0, 92.50, 0, 73.42, 0, 73.42, 0];
  const hmB2 = [73.42, 0, 73.42, 0, 77.78, 0, 73.42, 0, 73.42, 0, 92.50, 0, 87.31, 92.50, 98.00, 0];
  const hmA3 = [73.42, 0, 73.42, 0, 73.42, 0, 77.78, 0, 77.78, 0, 87.31, 0, 87.31, 0, 92.50, 0];
  const hmB3 = [92.50, 0, 98.00, 0, 110.00, 0, 98.00, 0, 92.50, 0, 87.31, 0, 77.78, 0, 73.42, 0];
  // Power-chord fifths stacked above the tab roots
  const hmSta0 = [110.00, 0, 110.00, 0, 116.54, 0, 110.00, 0, 110.00, 0, 138.59, 0, 110.00, 0, 110.00, 0];
  const hmSta1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 110.00, 0, 0, 0];
  const hmSta2 = [110.00, 110.00, 0, 0, 116.54, 0, 110.00, 0, 110.00, 0, 138.59, 0, 130.81, 138.59, 146.83, 0];
  const hmSta3 = [110.00, 0, 116.54, 0, 130.81, 0, 138.59, 0, 146.83, 0, 138.59, 0, 116.54, 0, 110.00, 0];
  // Palm-muted ghost strokes on the swung offbeats
  const hmChg0 = [0, 73.42, 0, 73.42, 0, 73.42, 0, 73.42, 0, 73.42, 0, 73.42, 0, 73.42, 0, 73.42];
  const hmChg1 = [0, 0, 0, 0, 73.42, 0, 0, 0, 0, 0, 0, 0, 73.42, 0, 0, 0];
  const hmChg2 = [73.42, 73.42, 0, 73.42, 73.42, 73.42, 0, 73.42, 73.42, 73.42, 0, 73.42, 0, 73.42, 73.42, 0];
  const hmChg3 = [0, 73.42, 0, 0, 0, 73.42, 0, 0, 0, 73.42, 0, 0, 0, 73.42, 0, 0];
  // Marching drumline: tenor toms on offbeats + roll fills
  const hmTom0 = [0, 0, 0, 0, 0, 0, 98.00, 0, 0, 0, 0, 0, 0, 0, 110.00, 0];
  const hmTom1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 98.00, 0, 110.00, 0, 130.81, 146.83];
  const hmTom2 = [0, 0, 98.00, 0, 0, 0, 98.00, 0, 0, 0, 110.00, 0, 0, 0, 110.00, 0];
  const hmTom3 = [0, 0, 0, 0, 98.00, 0, 98.00, 0, 110.00, 0, 110.00, 0, 130.81, 146.83, 155.56, 0];
  const hmCsh0 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0];
  const hmCsh1 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const hmCsh2 = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  const hmCsh3 = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0];
  // Mechanical ratchet density per 8th: 1=tick, 2=double-tick
  const hmRoll0 = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
  const hmRoll1 = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
  const hmRoll2 = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 2];
  const hmRoll3 = [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2];
  // 5th section — the choir-wail climax: the HM2 chant motif D-D#-C-D
  const hmKick4 = [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 1];
  const hmA4 = [73.42, 73.42, 0, 0, 77.78, 0, 73.42, 0, 73.42, 0, 92.50, 0, 73.42, 0, 73.42, 0];
  const hmB4 = [73.42, 0, 73.42, 0, 77.78, 0, 73.42, 0, 73.42, 0, 92.50, 0, 87.31, 92.50, 98.00, 0];
  // D4=293.66 D#4=311.13 C4=261.63 — the wailing chant above the stomp
  const hmSta4 = [293.66, 0, 0, 0, 311.13, 0, 261.63, 0, 293.66, 0, 0, 0, 293.66, 0, 311.13, 0];
  const hmChg4 = [0, 73.42, 0, 73.42, 0, 73.42, 0, 73.42, 0, 73.42, 0, 73.42, 0, 73.42, 0, 73.42];
  const hmTom4 = [0, 0, 0, 0, 0, 0, 146.83, 0, 0, 0, 0, 0, 110.00, 130.81, 146.83, 0];
  const hmCsh4 = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  const hmRoll4 = [1, 0, 1, 0, 1, 0, 1, 0, 2, 2, 2, 2, 2, 2, 2, 2];

  // ── Iron March (NEW track — Hell March essence overdriven) ────────
  // Same D Phrygian drop-D stomp, pushed harder/faster/brutaler with a
  // 2:11 fixed arrangement and tempo-synced neuro wobble bass.
  // D2=73.42 Eb2=77.78 F2=87.31 F#2=92.50 G2=98.00 Ab2=103.83 D1=36.71
  const KICK_SINGLE = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const imDroneA = [73.42, 0, 0, 0, 0, 0, 0, 0, 73.42, 0, 0, 0, 0, 0, 0, 0];
  const imDroneB = [73.42, 0, 0, 0, 0, 0, 0, 0, 73.42, 0, 0, 0, 0, 0, 0, 0];
  const imBd1A = [73.42, 0, 73.42, 0, 77.78, 0, 73.42, 0, 73.42, 0, 73.42, 0, 77.78, 0, 73.42, 0];
  const imBd1B = [73.42, 0, 73.42, 0, 77.78, 0, 73.42, 0, 73.42, 0, 92.50, 0, 87.31, 92.50, 98.00, 0];
  const imBd2A = [73.42, 0, 73.42, 0, 77.78, 0, 73.42, 0, 73.42, 0, 92.50, 0, 73.42, 0, 73.42, 0];
  const imBd2B = [73.42, 0, 73.42, 0, 77.78, 0, 73.42, 0, 73.42, 0, 92.50, 0, 87.31, 92.50, 98.00, 0];
  const imBd3A = [73.42, 0, 73.42, 0, 73.42, 0, 77.78, 0, 77.78, 0, 87.31, 0, 87.31, 0, 92.50, 0];
  const imBd3B = [92.50, 0, 98.00, 0, 110.00, 0, 98.00, 0, 92.50, 0, 87.31, 0, 77.78, 0, 73.42, 0];
  const imDrpA = [73.42, 73.42, 77.78, 73.42, 87.31, 73.42, 92.50, 87.31, 73.42, 73.42, 77.78, 73.42, 98.00, 92.50, 87.31, 36.71];
  const imDrpB = [73.42, 92.50, 98.00, 92.50, 87.31, 77.78, 73.42, 36.71, 73.42, 73.42, 77.78, 73.42, 87.31, 92.50, 98.00, 103.83];
  const imDrpC = [36.71, 0, 73.42, 0, 77.78, 0, 87.31, 0, 92.50, 0, 98.00, 0, 103.83, 0, 110.00, 0];
  const imDrpD = [110.00, 0, 103.83, 0, 98.00, 0, 92.50, 0, 87.31, 0, 77.78, 0, 73.42, 0, 36.71, 0];
  const imMaA = [73.42, 0, 73.42, 0, 77.78, 0, 73.42, 0, 73.42, 0, 92.50, 0, 73.42, 0, 73.42, 0];
  const imMaB = [73.42, 0, 73.42, 0, 77.78, 0, 73.42, 0, 73.42, 0, 92.50, 0, 87.31, 92.50, 98.00, 0];
  const imMbA = [73.42, 73.42, 0, 0, 77.78, 0, 73.42, 0, 73.42, 0, 92.50, 0, 73.42, 0, 73.42, 0];
  const imMbB = [73.42, 0, 73.42, 0, 77.78, 0, 73.42, 0, 73.42, 0, 92.50, 0, 87.31, 92.50, 98.00, 0];
  const imBrkA = [36.71, 0, 0, 0, 0, 0, 36.71, 0, 0, 0, 0, 0, 0, 0, 36.71, 0];
  const imBrkB = [36.71, 0, 0, 0, 0, 0, 36.71, 0, 0, 0, 0, 0, 0, 0, 36.71, 0];
  const imRisA = [73.42, 0, 73.42, 0, 73.42, 0, 73.42, 0, 87.31, 0, 92.50, 0, 98.00, 0, 103.83, 0];
  const imRisB = [87.31, 0, 92.50, 0, 98.00, 0, 103.83, 0, 110.00, 0, 103.83, 0, 98.00, 0, 92.50, 0];
  const imFinA = [73.42, 73.42, 77.78, 73.42, 87.31, 73.42, 92.50, 87.31, 73.42, 73.42, 77.78, 73.42, 98.00, 92.50, 98.00, 36.71];
  const imFinB = [73.42, 92.50, 98.00, 92.50, 87.31, 77.78, 73.42, 36.71, 110.00, 103.83, 98.00, 92.50, 87.31, 92.50, 98.00, 103.83];
  const imFinC = [73.42, 73.42, 77.78, 77.78, 87.31, 87.31, 92.50, 92.50, 73.42, 73.42, 77.78, 87.31, 92.50, 98.00, 103.83, 110.00];
  const imFinD = [110.00, 103.83, 98.00, 92.50, 87.31, 77.78, 73.42, 36.71, 73.42, 73.42, 77.78, 77.78, 87.31, 92.50, 98.00, 36.71];
  const imOutA = [73.42, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 36.71, 0, 0, 0];
  const imOutB = [73.42, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 36.71, 0, 0, 0];
  const imStIdle = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const imStDrn = [146.83, 0, 0, 0, 0, 0, 0, 0, 146.83, 0, 0, 0, 0, 0, 0, 0];
  const imStBd1 = [0, 0, 0, 0, 110.00, 0, 0, 0, 0, 0, 0, 0, 110.00, 0, 0, 0];
  const imStBd2 = [110.00, 0, 110.00, 0, 116.54, 0, 110.00, 0, 110.00, 0, 138.59, 0, 110.00, 0, 110.00, 0];
  const imStBd3 = [110.00, 0, 116.54, 0, 130.81, 0, 138.59, 0, 146.83, 0, 138.59, 0, 116.54, 0, 110.00, 0];
  const imStDrpA = [0, 110.00, 0, 110.00, 0, 110.00, 0, 110.00, 0, 138.59, 0, 138.59, 0, 110.00, 0, 110.00];
  const imStDrpB = [0, 0, 0, 0, 174.61, 0, 174.61, 0, 0, 0, 0, 0, 185.00, 0, 196.00, 0];
  const imStMaA = [110.00, 0, 110.00, 0, 116.54, 0, 110.00, 0, 110.00, 0, 138.59, 0, 110.00, 0, 110.00, 0];
  const imStMbA = [293.66, 0, 0, 0, 311.13, 0, 261.63, 0, 293.66, 0, 0, 0, 293.66, 0, 311.13, 0];
  const imStMbB = [110.00, 110.00, 0, 0, 116.54, 0, 110.00, 0, 110.00, 0, 138.59, 0, 130.81, 138.59, 146.83, 0];
  const imStRis = [110.00, 0, 116.54, 0, 130.81, 0, 138.59, 0, 146.83, 0, 155.56, 0, 164.81, 0, 174.61, 0];
  const imStFin = [293.66, 0, 0, 0, 311.13, 0, 261.63, 0, 293.66, 0, 0, 0, 293.66, 0, 311.13, 0];
  const imStFin2 = [293.66, 293.66, 311.13, 311.13, 293.66, 293.66, 349.23, 349.23, 311.13, 311.13, 293.66, 293.66, 311.13, 349.23, 293.66, 0];
  const imStOut = [146.83, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 146.83, 0, 0, 0];
  const imChgIdle = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const imChgDrp = [73.42, 73.42, 73.42, 73.42, 73.42, 73.42, 0, 73.42, 73.42, 73.42, 0, 73.42, 73.42, 73.42, 73.42, 0];
  const imGhs0 = [0, 73.42, 0, 73.42, 0, 73.42, 0, 73.42, 0, 73.42, 0, 73.42, 0, 73.42, 0, 73.42];
  const imGhs1 = [73.42, 73.42, 0, 73.42, 73.42, 73.42, 0, 73.42, 73.42, 73.42, 0, 73.42, 0, 73.42, 73.42, 0];
  const imTomIdle = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const imTom0 = [0, 0, 0, 0, 0, 0, 98.00, 0, 0, 0, 0, 0, 0, 0, 110.00, 0];
  const imTom1 = [0, 0, 98.00, 0, 0, 0, 98.00, 0, 0, 0, 110.00, 0, 0, 0, 110.00, 0];
  const imTom2 = [0, 0, 0, 0, 98.00, 0, 98.00, 0, 110.00, 0, 110.00, 0, 130.81, 146.83, 155.56, 0];
  const imTomDrp = [0, 0, 98.00, 0, 0, 0, 98.00, 0, 0, 0, 110.00, 0, 0, 0, 130.81, 146.83];
  const imTomBrk = [0, 0, 0, 0, 73.42, 0, 0, 0, 0, 0, 0, 0, 110.00, 0, 130.81, 0];
  const imCshIdle = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const imCsh0 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0];
  const imCsh1 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const imCsh2 = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  const imRollIdle = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const imRoll0 = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
  const imRoll1 = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
  const imRoll2 = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 2];
  const imRoll3 = [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2];
  const imRollBrk = [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1];

  // ── Industrial (Duke3D, E minor) bass lines ──────────────────────

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
    82.41, 82.41, 0, 82.41,
    82.41, 0, 82.41, 82.41,
    82.41, 0, 98.00, 0,
    98.00, 0, 123.47, 82.41,
  ];

  const bassPattern4 = [
    82.41, 82.41, 0, 82.41,
    82.41, 0, 82.41, 82.41,
    82.41, 0, 73.42, 0,
    98.00, 0, 73.42, 82.41,
  ];

  const bassPattern5 = [
    82.41, 82.41, 0, 82.41,
    82.41, 0, 82.41, 82.41,
    98.00, 98.00, 0, 98.00,
    82.41, 0, 98.00, 82.41,
  ];

  const bassPattern6 = [
    82.41, 82.41, 0, 98.00,
    82.41, 0, 110.00, 82.41,
    123.47, 123.47, 0, 123.47,
    98.00, 0, 82.41, 82.41,
  ];

  const bassPattern7 = [
    82.41, 82.41, 0, 82.41,
    82.41, 0, 82.41, 82.41,
    98.00, 98.00, 0, 98.00,
    98.00, 0, 110.00, 123.47,
  ];

  const bassPattern8 = [
    82.41, 82.41, 0, 110.00,
    82.41, 0, 123.47, 82.41,
    82.41, 82.41, 0, 82.41,
    98.00, 0, 110.00, 82.41,
  ];

  const bassPattern9 = [
    82.41, 82.41, 0, 82.41,
    82.41, 0, 82.41, 82.41,
    82.41, 0, 123.47, 0,
    98.00, 0, 123.47, 82.41,
  ];

  const bassPattern10 = [
    82.41, 82.41, 0, 98.00,
    82.41, 0, 82.41, 0,
    73.42, 0, 82.41, 0,
    123.47, 0, 82.41, 82.41,
  ];

  const bassPattern11 = [
    82.41, 82.41, 0, 82.41,
    98.00, 98.00, 0, 98.00,
    110.00, 110.00, 0, 110.00,
    123.47, 123.47, 0, 123.47,
  ];

  const bassPattern12 = [
    123.47, 0, 110.00, 0,
    98.00, 0, 82.41, 82.41,
    82.41, 82.41, 0, 82.41,
    98.00, 0, 110.00, 82.41,
  ];

  const kickPattern = [
    1, 0, 0, 0, 1, 0, 0, 0,
    1, 0, 0, 0, 1, 0, 1, 0,
  ];

  // Syncopated kick for the Heavy section (offset hits, same count as main for even energy)
  const kickPattern2 = [
    1, 0, 0, 0, 0, 0, 1, 0,
    1, 0, 0, 0, 1, 0, 1, 0,
  ];

  // Busy kick for the Drive section (almost every 8th, plus a big hit with the open hat)
  const kickPattern3 = [
    1, 0, 1, 0, 1, 0, 1, 0,
    1, 0, 1, 0, 1, 0, 1, 1,
  ];

  // Sparse ghost kick for the Float section (beats 1 + and-of-2, mirrored in bar 2)
  const kickPattern4 = [
    1, 0, 0, 0, 0, 0, 1, 0,
    1, 0, 0, 0, 0, 0, 1, 0,
  ];

  // Rolling build kick for the Rise section (backbeat + rising roll at bar end)
  const kickPattern5 = [
    1, 0, 0, 0, 1, 0, 0, 0,
    1, 0, 1, 0, 1, 1, 1, 1,
  ];

  // Machine-tool rattle for the Industrial rise section
  const indRoll5 = [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2];

  const snarePattern = [
    0, 0, 0, 0, 1, 0, 0, 0,
    0, 0, 0, 0, 1, 0, 0, 0,
  ];

  const hhPattern = [
    1, 0, 1, 0, 1, 0, 1, 0,
    1, 0, 1, 0, 1, 0, 1, 2,
  ]; // 1=closed, 2=open

  // ── Track definitions ─────────────────────────────────────────────
  const INDUSTRIAL_TRACK: TrackDef = {
    id: 'industrial',
    name: 'Industrial',
    emoji: '⚙️',
    bpm: 140,
    mainSection: 0,
    mainLoops: 15,
    altLoops: { min: 5, max: 10 },
    drums: {
      kick: { start: 150, end: 30, dur: 0.2, gain: 0.5, type: 'sine' },
      snare: { noiseGain: 0.22, filter: 2000, bodyGain: 0.15, bodyStart: 200, bodyEnd: 100 },
      hh: { closedGain: 0.07, openGain: 0.1 },
      rattle: { gain: 0.08, filter: 4500 },
    },
    bass: { gain: 0.26, fStart: 1100, fEnd: 250, q: 3 },
    stab: { gain: 0, fStart: 800, fEnd: 400, q: 2, type: 'square', dur: 0.2 },
    chug: { gain: 0, fStart: 500, fEnd: 150, q: 3, type: 'square', dur: 0.12 },
    tom: { gain: 0, sweep: 0.1, ring: 0.2 },
    crash: { gain: 0 },
    sections: [
      { kick: kickPattern, bassA: bassPattern, bassB: bassPattern2 },
      { kick: kickPattern, bassA: bassPattern3, bassB: bassPattern4 },
      { kick: kickPattern2, bassA: bassPattern5, bassB: bassPattern6 },
      { kick: kickPattern3, bassA: bassPattern7, bassB: bassPattern8 },
      { kick: kickPattern4, bassA: bassPattern9, bassB: bassPattern10 },
      { kick: kickPattern5, bassA: bassPattern11, bassB: bassPattern12, roll: indRoll5 },
    ],
  };

  const FATALITY_TRACK: TrackDef = {
    id: 'fatality',
    name: 'Fatality',
    emoji: '💀',
    bpm: 132,
    jitter: 0.003,
    mainSection: 0,
    mainLoops: 15,
    altLoops: { min: 5, max: 10 },
    drums: {
      kick: { start: 210, end: 26, dur: 0.34, gain: 0.85, type: 'sine' },
      snare: { noiseGain: 0.32, filter: 1600, bodyGain: 0.3, bodyStart: 250, bodyEnd: 70 },
      hh: { closedGain: 0.035, openGain: 0.09 },
      rattle: { gain: 0, filter: 4000 },
    },
    bass: { gain: 0.3, fStart: 900, fEnd: 150, q: 2.5 },
    stab: { gain: 0.3, fStart: 1400, fEnd: 600, q: 1.5, type: 'square', dur: 0.22 },
    chug: { gain: 0.2, fStart: 300, fEnd: 70, q: 4, type: 'square', dur: 0.18 },
    tom: { gain: 0.34, sweep: 0.12, ring: 0.26 },
    crash: { gain: 0.26 },
    sections: [
      { kick: KICK_MK, bassA: fatA0, bassB: fatB0, stab: mkSta0, tom: mkTom0, crash: mkCsh0 },
      { kick: KICK_MK, bassA: fatA1, bassB: fatB1, stab: mkSta1, tom: mkTom1, crash: mkCsh1 },
      { kick: KICK_FULL, bassA: fatA2, bassB: fatB2, stab: mkSta2, chug: mkChg2, tom: mkTom2, crash: mkCsh2 },
      { kick: KICK_RISE, bassA: fatA3, bassB: fatB3, stab: mkSta3, chug: mkChg3, tom: mkTom3, crash: mkCsh3 },
    ],
  };

  const RIP_AND_TEAR_TRACK: TrackDef = {
    id: 'rip-and-tear',
    name: 'Rip & Tear',
    emoji: '🎸',
    bpm: 180,
    swing: 0.05,
    jitter: 0.004,
    mainSection: 0,
    mainLoops: 15,
    altLoops: { min: 5, max: 10 },
    drums: {
      kick: { start: 190, end: 30, dur: 0.3, gain: 0.95, type: 'sine' },
      snare: { noiseGain: 0.42, filter: 3400, bodyGain: 0.16, bodyStart: 220, bodyEnd: 130 },
      hh: { closedGain: 0.05, openGain: 0.12 },
      rattle: { gain: 0.1, filter: 4000 },
    },
    bass: { gain: 0.3, fStart: 1400, fEnd: 300, q: 1.5 },
    stab: { gain: 0.24, fStart: 1600, fEnd: 400, q: 1.5, type: 'sawtooth', dur: 0.16, detune: 8, vibrato: 0, filter: 'lowpass' },
    chug: { gain: 0.32, fStart: 800, fEnd: 150, q: 3, type: 'square', dur: 0.09 },
    tom: { gain: 0.2, sweep: 0.08, ring: 0.16 },
    crash: { gain: 0.26 },
    sections: [
      { kick: KICK_FULL, bassA: rstA0, bassB: rstB0, stab: rstSta0, chug: rstChg0, tom: rstTom0, crash: rstCsh0, roll: rstRoll0 },
      { kick: KICK_BLAST, bassA: rstA1, bassB: rstB1, stab: rstSta1, chug: rstChg1, crash: rstCsh1, roll: rstRoll1 },
      { kick: KICK_BLAST, bassA: rstA2, bassB: rstB2, stab: rstSta2, chug: rstChg2, tom: rstTom2, crash: rstCsh2, roll: rstRoll2 },
      { kick: KICK_RISE, bassA: rstA3, bassB: rstB3, stab: rstSta3, chug: rstChg3, tom: rstTom3, crash: rstCsh3, roll: rstRoll3 },
    ],
  };

  const VOID_PRISM_TRACK: TrackDef = {
    id: 'void-prism',
    name: 'Void Prism',
    emoji: '🔮',
    bpm: 102,
    mainSection: 0,
    mainLoops: 15,
    altLoops: { min: 5, max: 10 },
    drums: {
      kick: { start: 120, end: 28, dur: 0.3, gain: 0.45, type: 'sine' },
      snare: { noiseGain: 0.16, filter: 3000, bodyGain: 0.1, bodyStart: 260, bodyEnd: 130 },
      hh: { closedGain: 0.03, openGain: 0.1 },
      rattle: { gain: 0, filter: 4000 },
    },
    bass: { gain: 0.24, fStart: 900, fEnd: 200, q: 4 },
    stab: { gain: 0.12, fStart: 700, fEnd: 250, q: 1, type: 'sawtooth', dur: 0.3, vibrato: 0.012, filter: 'lowpass' },
    chug: { gain: 0, fStart: 400, fEnd: 120, q: 3, type: 'square', dur: 0.12 },
    tom: { gain: 0, sweep: 0.1, ring: 0.2 },
    crash: { gain: 0 },
    sections: [
      { kick: KICK_GHOST, bassA: vdA0, bassB: vdB0 },
      { kick: KICK_GHOST, bassA: vdA1, bassB: vdB1, stab: vdSta2 },
      { kick: KICK_FULL, bassA: vdA2, bassB: vdB2, stab: vdSta2 },
      { kick: KICK_RISE, bassA: vdA3, bassB: vdB3, stab: vdSta3 },
    ],
  };

  const HELL_MARCH_TRACK: TrackDef = {
    id: 'hell-march',
    name: 'Hell March',
    emoji: '☢️',
    bpm: 124,
    swing: 0.16,
    jitter: 0.006,
    mainSection: 0,
    mainLoops: 15,
    altLoops: { min: 5, max: 10 },
    drums: {
      kick: { start: 200, end: 26, dur: 0.4, gain: 0.95, type: 'sine' },
      snare: { noiseGain: 0.55, filter: 3200, bodyGain: 0.3, bodyStart: 220, bodyEnd: 80 },
      hh: { closedGain: 0.03, openGain: 0.08 },
      rattle: { gain: 0.18, filter: 3500 },
    },
    bass: { gain: 0.36, fStart: 700, fEnd: 140, q: 3 },
    stab: { gain: 0.3, fStart: 700, fEnd: 140, q: 1.5, type: 'sawtooth', dur: 0.28, detune: 6, vibrato: 0, filter: 'lowpass' },
    chug: { gain: 0.32, fStart: 500, fEnd: 120, q: 6, type: 'square', dur: 0.09 },
    tom: { gain: 0.34, sweep: 0.12, ring: 0.22 },
    crash: { gain: 0.28 },
    sections: [
      { kick: hmKick0, bassA: hmA0, bassB: hmB0, stab: hmSta0, chug: hmChg0, tom: hmTom0, crash: hmCsh0, roll: hmRoll0 },
      { kick: hmKick1, bassA: hmA1, bassB: hmB1, stab: hmSta1, chug: hmChg1, tom: hmTom1, crash: hmCsh1, roll: hmRoll1 },
      { kick: hmKick2, bassA: hmA2, bassB: hmB2, stab: hmSta2, chug: hmChg2, tom: hmTom2, crash: hmCsh2, roll: hmRoll2 },
      { kick: hmKick3, bassA: hmA3, bassB: hmB3, stab: hmSta3, chug: hmChg3, tom: hmTom3, crash: hmCsh3, roll: hmRoll3 },
      { kick: hmKick4, bassA: hmA4, bassB: hmB4, stab: hmSta4, chug: hmChg4, tom: hmTom4, crash: hmCsh4, roll: hmRoll4 },
    ],
  };

  const IRON_MARCH_TRACK: TrackDef = {
    id: 'iron-march',
    name: 'Iron March',
    emoji: '⚡',
    bpm: 150,
    swing: 0.12,
    jitter: 0.003,
    mainSection: 0,
    mainLoops: 15,
    altLoops: { min: 5, max: 10 },
    drums: {
      kick: { start: 220, end: 24, dur: 0.34, gain: 1.05, type: 'sine' },
      snare: { noiseGain: 0.65, filter: 2500, bodyGain: 0.35, bodyStart: 240, bodyEnd: 70 },
      hh: { closedGain: 0.05, openGain: 0.11 },
      rattle: { gain: 0.26, filter: 3200 },
    },
    bass: { gain: 0.36, fStart: 700, fEnd: 140, q: 3 },
    neuBass: { gain: 0.4, fStart: 1500, fEnd: 900, q: 7, detune: 14, lfoDepth: 1100, lfoRate: 0 },
    stab: { gain: 0.36, fStart: 800, fEnd: 160, q: 1.5, type: 'sawtooth', dur: 0.24, detune: 8, vibrato: 0.006, filter: 'lowpass' },
    chug: { gain: 0.38, fStart: 600, fEnd: 110, q: 7, type: 'square', dur: 0.07 },
    tom: { gain: 0.42, sweep: 0.11, ring: 0.2 },
    crash: { gain: 0.34 },
    sections: [
      // 0 intro — dark D drone + ratchet chirp
      { kick: hmKick1, bassA: imDroneA, bassB: imDroneB, stab: imStDrn, chug: imChgIdle, tom: imTom0, crash: imCsh1, roll: imRoll0 },
      // 1 build 1 — stomp ignites, chug offbeats grind in
      { kick: hmKick1, bassA: imBd1A, bassB: imBd1B, stab: imStBd1, chug: imGhs0, tom: imTom0, crash: imCsh1, roll: imRoll1 },
      // 2 build 2 — the classic Klepacki riff, snare locks in
      { kick: hmKick0, bassA: imBd2A, bassB: imBd2B, stab: imStBd2, chug: imGhs0, tom: imTom0, crash: imCsh0, roll: imRoll2 },
      // 3 build 3 — chromatic climb, ratchet to double density
      { kick: hmKick0, bassA: imBd3A, bassB: imBd3B, stab: imStBd3, chug: imGhs1, tom: imTom2, crash: imCsh0, roll: imRoll3 },
      // 4 drop A — blast kicks + neuro bass run
      { kick: KICK_BLAST, bassA: imDrpA, bassB: imDrpB, stab: imStDrpA, chug: imChgDrp, tom: imTomDrp, crash: imCsh0, roll: imRoll2 },
      // 5 drop B — neuro octave-jump machine
      { kick: KICK_BLAST, bassA: imDrpC, bassB: imDrpD, stab: imStDrpB, chug: imChgDrp, tom: imTomDrp, crash: imCsh0, roll: imRoll3 },
      // 6 march verse A — the iconic power-chord stomp
      { kick: hmKick0, bassA: imMaA, bassB: imMaB, stab: imStMaA, chug: imGhs0, tom: imTom0, crash: imCsh0, roll: imRoll1 },
      // 7 march verse B — HM2 choir wail above the stomp
      { kick: hmKick2, bassA: imMbA, bassB: imMbB, stab: imStMbA, chug: imGhs1, tom: imTom1, crash: imCsh2, roll: imRoll2 },
      // 8 breakdown — sub pulses + taiko, the ratchet cuts through
      { kick: hmKick0, bassA: imBrkA, bassB: imBrkB, stab: imStIdle, chug: imChgIdle, tom: imTomBrk, crash: imCsh1, roll: imRollBrk },
      // 9 rise — pulsing D, register climbs, snare build
      { kick: KICK_RISE, bassA: imRisA, bassB: imRisB, stab: imStRis, chug: imGhs0, tom: imTom2, crash: imCsh0, roll: imRoll3 },
      // 10 finale A — all guns, raging neuro riff + choir wail
      { kick: KICK_BLAST, bassA: imFinA, bassB: imFinB, stab: imStFin, chug: imChgDrp, tom: imTomDrp, crash: imCsh2, roll: imRoll3 },
      // 11 finale B — double-time machine-gun climb
      { kick: KICK_BLAST, bassA: imFinC, bassB: imFinD, stab: imStFin2, chug: imGhs0, tom: imTom2, crash: imCsh2, roll: imRoll3 },
      // 12 outro — single power-chord sting
      { kick: KICK_SINGLE, bassA: imOutA, bassB: imOutB, stab: imStOut, chug: imChgIdle, tom: imTomIdle, crash: imCsh0, roll: imRollIdle },
    ],
    // Full 2:11 arrangement: intro → build → drop → march → breakdown
    // → rise → finale → outro, then the loop restarts from the top.
    timeline: [
      { section: 0, loops: 2 },
      { section: 1, loops: 2 },
      { section: 2, loops: 2 },
      { section: 3, loops: 2 },
      { section: 4, loops: 4 },
      { section: 5, loops: 4 },
      { section: 6, loops: 2 },
      { section: 7, loops: 2 },
      { section: 6, loops: 2 },
      { section: 7, loops: 2 },
      { section: 8, loops: 3 },
      { section: 9, loops: 4 },
      { section: 10, loops: 6 },
      { section: 11, loops: 3 },
      { section: 12, loops: 1 },
    ],
  };

  const TRACKS: TrackDef[] = [
    INDUSTRIAL_TRACK,
    FATALITY_TRACK,
    RIP_AND_TEAR_TRACK,
    VOID_PRISM_TRACK,
    HELL_MARCH_TRACK,
    IRON_MARCH_TRACK,
  ];

  const trackIndex = ref(loadTrackIndex());
  const currentTrackName = computed<string>(() => TRACKS[trackIndex.value].name);
  const currentTrackEmoji = computed<string>(() => TRACKS[trackIndex.value].emoji);

  // ── Track-aware scheduler state machine ───────────────────────────
  function enterSection(idx: number) {
    const track = TRACKS[trackIndex.value];
    currentSectionIdx = idx;
    sectionStepsLeft = idx === track.mainSection
      ? track.mainLoops
      : track.altLoops.min + Math.floor(Math.random() * (track.altLoops.max - track.altLoops.min + 1));
  }

  function schedulerTick() {
    if (!songCtx || !songDest || musicMuted.value) return;

    const audio = songCtx;
    const dest = songDest;
    const step = currentStep % 16;
    const time = audio.currentTime + 0.05;

    const track = TRACKS[trackIndex.value];
    const section = track.sections[currentSectionIdx];
    const stepDur = 60 / track.bpm / 2 * 1000;
    // Humanized groove: swing the offbeat 8ths + tiny random jitter
    const stepSec = stepDur / 1000;
    const swing = track.swing ?? 0;
    const jitter = track.jitter ?? 0;
    const t = time + (step % 2 === 1 ? swing : 0) * stepSec
      + (jitter > 0 ? (Math.random() * 2 - 1) * jitter * stepSec : 0);

    if (section.kick[step]) {
      playKick(audio, dest, t, track.drums.kick);
    }
    if (snarePattern[step]) {
      playSnare(audio, dest, t, track.drums.snare);
    }
    if (hhPattern[step] === 1) {
      playHiHat(audio, dest, t, false, track.drums.hh);
    } else if (hhPattern[step] === 2) {
      playHiHat(audio, dest, t, true, track.drums.hh);
    }

    const rollRate = section.roll?.[step] ?? 0;
    if (rollRate > 0) {
      const sub = stepDur / 1000 / rollRate;
      for (let i = 1; i <= rollRate; i++) {
        playRattle(audio, dest, t + sub * i, track.drums.rattle);
      }
    }

    const stabFreq = section.stab?.[step] ?? 0;
    if (stabFreq > 0) {
      playStab(audio, dest, t, stabFreq, track.stab);
    }

    const chugFreq = section.chug?.[step] ?? 0;
    if (chugFreq > 0) {
      playChug(audio, dest, t, chugFreq, track.chug);
    }

    const tomFreq = section.tom?.[step] ?? 0;
    if (tomFreq > 0) {
      playTom(audio, dest, t, tomFreq, track.tom);
    }

    if (section.crash?.[step]) {
      playCrash(audio, dest, t, track.crash);
    }

    const bassLine = Math.floor(currentStep / 16) % 2 === 0 ? section.bassA : section.bassB;
    const bassFreq = bassLine[step];
    if (bassFreq > 0) {
      const bassDur = stepDur / 1000 * 0.9;
      if (track.neuBass) {
        playNeuroBass(audio, dest, t, bassFreq, bassDur, track.neuBass, track.bpm);
      } else {
        playBass(audio, dest, t, bassFreq, bassDur, track.bass);
      }
    }

    currentStep++;
    sectionStepsLeft--;

    if (currentStep % 16 === 0 && sectionStepsLeft <= 0) {
      if (track.timeline && track.timeline.length > 0) {
        timelinePos = (timelinePos + 1) % track.timeline.length;
        const entry = track.timeline[timelinePos];
        currentSectionIdx = entry.section;
        sectionStepsLeft = entry.loops;
      } else {
        enterSection((currentSectionIdx + 1) % track.sections.length);
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
    const track = TRACKS[trackIndex.value];
    if (track.timeline && track.timeline.length > 0) {
      timelinePos = 0;
      const entry = track.timeline[0];
      currentSectionIdx = entry.section;
      sectionStepsLeft = entry.loops;
    } else {
      enterSection(track.mainSection);
    }

    const stepDur = 60 / TRACKS[trackIndex.value].bpm / 2 * 1000;
    beatTimer = window.setInterval(schedulerTick, stepDur);
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

  function nextTrack() {
    const wasPlaying = isPlaying.value && !musicMuted.value;
    if (wasPlaying) stopMusic();
    trackIndex.value = (trackIndex.value + 1) % TRACKS.length;
    localStorage.setItem('pvz2_music_track', String(trackIndex.value));
    if (wasPlaying) startMusic();
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
    currentTrackName,
    currentTrackEmoji,
    startMusic,
    stopMusic,
    nextTrack,
    playSfx,
    setMusicVolume,
    setSfxVolume,
    toggleMusicMute,
    toggleSfxMute,
    initOnInteraction,
    getFrequencyData,
  };
}
