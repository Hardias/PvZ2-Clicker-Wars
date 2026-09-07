// Pure helper that "prerenders" the visual equalizer for a single track section.
//
// The live music engine drives the audio; this module just turns the static
// 16-step section patterns into a fixed set of bar frames (one per 8th-note).
// Because the bars are derived from the same pattern arrays the sequencer uses,
// the result pulses on the exact same beats as the audio — but it is fully
// deterministic (no live FFT reads in the visualizer).

export const MAX_VISUAL_BARS = 96;
export const STEPS_PER_SECTION = 16;

const LOW_END = Math.floor(MAX_VISUAL_BARS * 0.34);
const MID_START = LOW_END;
const MID_END = Math.floor(MAX_VISUAL_BARS * 0.67);
const HIGH_END = MAX_VISUAL_BARS;

export interface SectionPatterns {
  kick: number[];
  bassA: number[];
  bassB: number[];
  stab?: number[];
  chug?: number[];
  tom?: number[];
  crash?: number[];
  roll?: number[];
}

export function buildSectionFrames(
  section: SectionPatterns,
  snarePattern: number[],
  hhPattern: number[],
): Float32Array[] {
  const frames: Float32Array[] = [];

  for (let step = 0; step < STEPS_PER_SECTION; step++) {
    frames.push(buildStepFrame(section, snarePattern, hhPattern, step));
  }

  return frames;
}

function bar(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function buildStepFrame(
  section: SectionPatterns,
  snarePattern: number[],
  hhPattern: number[],
  step: number,
): Float32Array {
  const frame = new Float32Array(MAX_VISUAL_BARS);

  // Low band: kick + bass (root pulse).
  const kick = section.kick[step] ? 1 : 0;
  const bass = Math.max(section.bassA[step] || 0, section.bassB[step] || 0) > 0 ? 1 : 0;
  const low = bar(kick * 0.85 + bass * 0.7 + (kick && bass ? 0.15 : 0));

  // Mid band: stab / chug / tom / roll.
  const stab = section.stab?.[step] ? 1 : 0;
  const chug = section.chug?.[step] ? 1 : 0;
  const tom = section.tom?.[step] ? 1 : 0;
  const roll = section.roll?.[step] ? 0.8 : 0;
  const mid = bar(stab * 0.7 + chug * 0.6 + tom * 0.6 + roll);

  // High band: snare + hihat + crash.
  const snare = snarePattern[step] ? 1 : 0;
  const hh = hhPattern[step] || 0; // 1=closed, 2=open
  const crash = section.crash?.[step] ? 1 : 0;
  const high = bar(snare * 0.8 + (hh === 2 ? 0.55 : hh === 1 ? 0.35 : 0) + crash * 0.6);

  // Paint the low band with a gentle height fade toward the right edge.
  for (let i = 0; i < LOW_END; i++) {
    frame[i] = low * (1 - (i / LOW_END) * 0.35);
  }

  // Mid band: envelope shaped around the centre for a fuller look.
  for (let i = MID_START; i < MID_END; i++) {
    const t = (i - MID_START) / (MID_END - MID_START);
    frame[i] = mid * (1 - Math.abs(t - 0.5) * 0.6);
  }

  // High band: sharp decay so the top bars flicker subtly.
  for (let i = MID_END; i < HIGH_END; i++) {
    const t = (i - MID_END) / (HIGH_END - MID_END);
    frame[i] = high * (1 - t) * 0.9 + high * 0.1;
  }

  return frame;
}
