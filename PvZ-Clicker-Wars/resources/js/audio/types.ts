export type SfxName =
  | 'attack'
  | 'wallHit'
  | 'wallDestroy'
  | 'shopBuy'
  | 'death'
  | 'teleport'
  | 'turretHit'
  | 'shopOpen'
  | 'save';

export interface AudioNodes {
  masterGain: GainNode;
  musicGain: GainNode;
  musicCompressor: DynamicsCompressorNode;
  sfxGain: GainNode;
  analyser: AnalyserNode;
  freqData: Uint8Array<ArrayBuffer>;
}

export interface TrackDrums {
  kick: { start: number; end: number; dur: number; gain: number; type: OscillatorType };
  snare: { noiseGain: number; filter: number; bodyGain: number; bodyStart: number; bodyEnd: number };
  hh: { closedGain: number; openGain: number };
  rattle: { gain: number; filter: number };
}

export interface TrackBass {
  gain: number;
  fStart: number;
  fEnd: number;
  q: number;
}

export interface TrackNeuro {
  gain: number;
  fStart: number;
  fEnd: number;
  q: number;
  detune: number;
  lfoDepth: number;
  lfoRate: number;
}

export interface TrackStab {
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

export interface TrackChug {
  gain: number;
  fStart: number;
  fEnd: number;
  q: number;
  type: OscillatorType;
  dur: number;
}

export interface TrackTom {
  gain: number;
  sweep: number;
  ring: number;
}

export interface TrackCrash {
  gain: number;
}

export interface TrackSection {
  kick: number[];
  bassA: number[];
  bassB: number[];
  stab?: number[];
  chug?: number[];
  tom?: number[];
  crash?: number[];
  roll?: number[];
}

export interface TrackDef {
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