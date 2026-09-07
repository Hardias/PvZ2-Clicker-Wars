import type { TrackDrums, TrackBass, TrackNeuro, TrackStab, TrackChug, TrackTom, TrackCrash } from './types';

export function createNoiseBuffer(audio: AudioContext, duration: number): AudioBuffer {
  const sampleRate = audio.sampleRate;
  const length = sampleRate * duration;
  const buffer = audio.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function playKick(audio: AudioContext, dest: GainNode, time: number, k: TrackDrums['kick']) {
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

export function playSnare(audio: AudioContext, dest: GainNode, time: number, s: TrackDrums['snare']) {
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

export function playHiHat(audio: AudioContext, dest: GainNode, time: number, open: boolean, h: TrackDrums['hh']) {
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
export function playRattle(audio: AudioContext, dest: GainNode, time: number, r: TrackDrums['rattle']) {
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

export function playBass(audio: AudioContext, dest: GainNode, time: number, freq: number, dur: number, b: TrackBass) {
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
export function playNeuroBass(audio: AudioContext, dest: GainNode, time: number, freq: number, dur: number, n: TrackNeuro, bpm: number) {
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
export function playStab(audio: AudioContext, dest: GainNode, time: number, freq: number, s: TrackStab) {
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
export function playChug(audio: AudioContext, dest: GainNode, time: number, freq: number, c: TrackChug) {
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
export function playTom(audio: AudioContext, dest: GainNode, time: number, freq: number, t: TrackTom) {
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
export function playCrash(audio: AudioContext, dest: GainNode, time: number, c: TrackCrash) {
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