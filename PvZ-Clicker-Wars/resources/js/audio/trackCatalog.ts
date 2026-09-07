import type { TrackDef } from './types';

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

// Shared drum pattern flavours used across tracks
const KICK_FULL = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0];
const KICK_MK = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0];
const KICK_GHOST = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0];
const KICK_RISE = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 1];
const KICK_BLAST = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

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

export const snarePattern = [
  0, 0, 0, 0, 1, 0, 0, 0,
  0, 0, 0, 0, 1, 0, 0, 0,
];

export const hhPattern = [
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

// ── For Aiur (NEW track — heroic Protoss anthem, A minor) ────────
// "MY LIFE FOR AIUR." A bright, aggressive anthem that lifts after the
// darkness of Iron March: A2 power-chord stomps, chromatic builds,
// tempo-synced neuro bass in the drops, and chant fifths (A-C-E) in the
// climaxes. Fixed 2:03 arrangement via track.timeline.
// A2=110.00 Bb2=116.54 C3=130.81 E2=82.41 E3=164.81 A4=440.00 C5=523.25 E5=659.26
const faDroneA = [110.00, 0, 0, 0, 0, 0, 0, 0, 110.00, 0, 0, 0, 0, 0, 0, 0];
const faDroneB = [110.00, 0, 0, 0, 0, 0, 0, 0, 110.00, 0, 0, 0, 0, 0, 0, 0];
const faStDrone = [220.00, 0, 0, 0, 0, 0, 220.00, 0, 0, 0, 0, 0, 0, 0, 220.00, 0];
const faStIdle = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const faChgIdle = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const faBd1A = [110.00, 0, 110.00, 0, 130.81, 0, 110.00, 0, 110.00, 0, 110.00, 0, 130.81, 0, 110.00, 0];
const faBd1B = [110.00, 0, 110.00, 0, 130.81, 0, 110.00, 0, 110.00, 0, 164.81, 0, 146.83, 164.81, 196.00, 0];
const faStBd1 = [110.00, 0, 0, 0, 138.59, 0, 0, 0, 110.00, 0, 0, 0, 138.59, 0, 0, 0];
const faBd2A = [110.00, 0, 110.00, 0, 116.54, 0, 110.00, 0, 110.00, 0, 130.81, 0, 116.54, 0, 110.00, 0];
const faBd2B = [110.00, 0, 110.00, 0, 116.54, 0, 110.00, 0, 110.00, 0, 130.81, 0, 146.83, 164.81, 196.00, 0];
const faStBd2 = [110.00, 0, 110.00, 0, 116.54, 0, 110.00, 0, 110.00, 0, 138.59, 0, 146.83, 164.81, 196.00, 0];
const faDrpA = [110.00, 110.00, 130.81, 110.00, 164.81, 110.00, 130.81, 82.41, 110.00, 110.00, 130.81, 110.00, 196.00, 164.81, 130.81, 82.41];
const faDrpB = [110.00, 164.81, 196.00, 164.81, 130.81, 110.00, 82.41, 110.00, 110.00, 130.81, 164.81, 130.81, 220.00, 196.00, 164.81, 110.00];
const faDrpC = [82.41, 0, 110.00, 0, 130.81, 0, 164.81, 0, 196.00, 0, 220.00, 0, 261.63, 0, 220.00, 0];
const faDrpD = [220.00, 0, 196.00, 0, 164.81, 0, 130.81, 0, 110.00, 0, 82.41, 0, 110.00, 0, 55.00, 0];
const faStDrpA = [0, 110.00, 0, 110.00, 0, 110.00, 0, 110.00, 0, 138.59, 0, 138.59, 0, 110.00, 0, 110.00];
const faStDrpB = [0, 0, 0, 0, 440.00, 0, 440.00, 0, 0, 0, 0, 0, 523.25, 0, 659.26, 0];
const faChgDrp = [110.00, 110.00, 110.00, 110.00, 110.00, 110.00, 0, 110.00, 110.00, 110.00, 0, 110.00, 110.00, 110.00, 110.00, 0];
const faGhs0 = [0, 110.00, 0, 110.00, 0, 110.00, 0, 110.00, 0, 110.00, 0, 110.00, 0, 110.00, 0, 110.00];
const faGhs1 = [110.00, 110.00, 0, 110.00, 110.00, 110.00, 0, 110.00, 110.00, 110.00, 0, 110.00, 0, 110.00, 110.00, 0];
const faMaA = [110.00, 0, 110.00, 0, 130.81, 0, 110.00, 0, 110.00, 0, 164.81, 0, 110.00, 0, 110.00, 0];
const faMaB = [110.00, 0, 110.00, 0, 130.81, 0, 110.00, 0, 110.00, 0, 164.81, 0, 146.83, 164.81, 196.00, 0];
const faStMaA = [110.00, 0, 110.00, 0, 138.59, 0, 110.00, 0, 110.00, 0, 164.81, 0, 138.59, 0, 110.00, 0];
const faStMbA = [440.00, 0, 0, 0, 523.25, 0, 440.00, 0, 440.00, 0, 0, 0, 659.26, 0, 523.25, 0];
const faBrkA = [55.00, 0, 0, 0, 0, 0, 55.00, 0, 0, 0, 0, 0, 0, 0, 55.00, 0];
const faBrkB = [55.00, 0, 0, 0, 0, 0, 55.00, 0, 0, 0, 0, 0, 0, 0, 55.00, 0];
const faRisA = [110.00, 0, 110.00, 0, 130.81, 0, 130.81, 0, 164.81, 0, 164.81, 0, 196.00, 0, 220.00, 0];
const faRisB = [220.00, 0, 196.00, 0, 164.81, 0, 130.81, 0, 110.00, 0, 130.81, 0, 164.81, 0, 196.00, 0];
const faStRis = [110.00, 0, 116.54, 0, 130.81, 0, 138.59, 0, 146.83, 0, 164.81, 0, 196.00, 0, 220.00, 0];
const faFinA = [110.00, 110.00, 130.81, 110.00, 164.81, 110.00, 130.81, 82.41, 110.00, 130.81, 164.81, 130.81, 196.00, 220.00, 196.00, 55.00];
const faFinB = [110.00, 164.81, 196.00, 164.81, 130.81, 110.00, 82.41, 55.00, 220.00, 196.00, 164.81, 130.81, 110.00, 130.81, 164.81, 196.00];
const faFinC = [110.00, 110.00, 116.54, 116.54, 130.81, 130.81, 146.83, 146.83, 110.00, 110.00, 130.81, 164.81, 196.00, 220.00, 261.63, 293.66];
const faFinD = [293.66, 261.63, 220.00, 196.00, 164.81, 130.81, 110.00, 55.00, 110.00, 110.00, 130.81, 130.81, 164.81, 196.00, 220.00, 55.00];
const faStFin = [440.00, 0, 0, 0, 523.25, 0, 440.00, 0, 440.00, 0, 0, 0, 659.26, 0, 523.25, 0];
const faStFin2 = [440.00, 440.00, 523.25, 523.25, 440.00, 440.00, 659.26, 659.26, 523.25, 523.25, 440.00, 440.00, 523.25, 659.26, 440.00, 0];
const faOutA = [110.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 55.00, 0, 0, 0];
const faOutB = [110.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 55.00, 0, 0, 0];
const faStOut = [220.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 220.00, 0, 0, 0];
const faTomIdle = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const faTom1 = [0, 0, 98.00, 0, 0, 0, 98.00, 0, 0, 0, 110.00, 0, 0, 0, 110.00, 0];
const faTom2 = [0, 0, 0, 0, 98.00, 0, 98.00, 0, 110.00, 0, 110.00, 0, 130.81, 146.83, 164.81, 0];
const faTomDrp = [0, 0, 98.00, 0, 0, 0, 98.00, 0, 0, 0, 110.00, 0, 0, 0, 130.81, 146.83];
const faTomBrk = [0, 0, 0, 0, 55.00, 0, 0, 0, 0, 0, 0, 0, 110.00, 0, 130.81, 0];
const faCsh0 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0];
const faCsh1 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const faCsh2 = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
const faRollIdle = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const faRoll0 = [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1];
const faRoll1 = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
const faRoll2 = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 2];
const faRoll3 = [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2];
const faRollBrk = [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1];

const FOR_AIUR_TRACK: TrackDef = {
  id: 'for-aiur',
  name: 'For Aiur',
  emoji: '⚔️',
  bpm: 158,
  swing: 0.03,
  jitter: 0.003,
  mainSection: 0,
  mainLoops: 15,
  altLoops: { min: 5, max: 10 },
  drums: {
    kick: { start: 210, end: 26, dur: 0.36, gain: 0.98, type: 'sine' },
    snare: { noiseGain: 0.58, filter: 3000, bodyGain: 0.33, bodyStart: 230, bodyEnd: 75 },
    hh: { closedGain: 0.05, openGain: 0.12 },
    rattle: { gain: 0.22, filter: 3600 },
  },
  bass: { gain: 0.34, fStart: 800, fEnd: 150, q: 3 },
  neuBass: { gain: 0.42, fStart: 1600, fEnd: 900, q: 7, detune: 12, lfoDepth: 1100, lfoRate: 0 },
  stab: { gain: 0.34, fStart: 900, fEnd: 200, q: 1.5, type: 'sawtooth', dur: 0.24, detune: 8, vibrato: 0.006, filter: 'lowpass' },
  chug: { gain: 0.36, fStart: 550, fEnd: 110, q: 7, type: 'square', dur: 0.07 },
  tom: { gain: 0.42, sweep: 0.11, ring: 0.2 },
  crash: { gain: 0.32 },
  sections: [
    // 0 intro — A drone + light ratchet chirp
    { kick: KICK_GHOST, bassA: faDroneA, bassB: faDroneB, stab: faStDrone, chug: faChgIdle, tom: faTomIdle, crash: faCsh1, roll: faRoll0 },
    // 1 build 1 — power-chord stomp, chug offbeats grind in
    { kick: KICK_MK, bassA: faBd1A, bassB: faBd1B, stab: faStBd1, chug: faGhs0, tom: faTom1, crash: faCsh1, roll: faRoll0 },
    // 2 build 2 — chromatic climb A -> Bb -> C, fifths stack
    { kick: KICK_FULL, bassA: faBd2A, bassB: faBd2B, stab: faStBd2, chug: faGhs0, tom: faTom1, crash: faCsh0, roll: faRoll1 },
    // 3 drop A — blast kicks + neuro bass run
    { kick: KICK_BLAST, bassA: faDrpA, bassB: faDrpB, stab: faStDrpA, chug: faChgDrp, tom: faTomDrp, crash: faCsh0, roll: faRoll2 },
    // 4 drop B — neuro octave-jump machine
    { kick: KICK_BLAST, bassA: faDrpC, bassB: faDrpD, stab: faStDrpB, chug: faChgDrp, tom: faTomDrp, crash: faCsh0, roll: faRoll3 },
    // 5 anthem A — heroic A power-chord stomp
    { kick: KICK_FULL, bassA: faMaA, bassB: faMaB, stab: faStMaA, chug: faGhs0, tom: faTom2, crash: faCsh0, roll: faRoll1 },
    // 6 anthem B — the chant (A-C-E) wails above the anthem
    { kick: KICK_RISE, bassA: faMaA, bassB: faMaB, stab: faStMbA, chug: faGhs1, tom: faTom1, crash: faCsh2, roll: faRoll2 },
    // 7 breakdown — sub pulses + taiko, ratchet cuts through
    { kick: KICK_GHOST, bassA: faBrkA, bassB: faBrkB, stab: faStIdle, chug: faChgIdle, tom: faTomBrk, crash: faCsh1, roll: faRollBrk },
    // 8 rise — register climbs, snare build
    { kick: KICK_RISE, bassA: faRisA, bassB: faRisB, stab: faStRis, chug: faGhs0, tom: faTom2, crash: faCsh0, roll: faRoll3 },
    // 9 finale A — all guns: neuro riff + chant
    { kick: KICK_BLAST, bassA: faFinA, bassB: faFinB, stab: faStFin, chug: faChgDrp, tom: faTomDrp, crash: faCsh2, roll: faRoll3 },
    // 10 finale B — double-time machine-gun climb
    { kick: KICK_BLAST, bassA: faFinC, bassB: faFinD, stab: faStFin2, chug: faGhs0, tom: faTom2, crash: faCsh2, roll: faRoll3 },
    // 11 outro — single A power-chord sting
    { kick: KICK_SINGLE, bassA: faOutA, bassB: faOutB, stab: faStOut, chug: faChgIdle, tom: faTomIdle, crash: faCsh0, roll: faRollIdle },
  ],
  // Fixed 2:03 arrangement: intro -> builds -> drops -> anthem -> breakdown
  // -> rise -> finale -> outro, then the loop restarts from the top.
  timeline: [
    { section: 0, loops: 2 },
    { section: 1, loops: 2 },
    { section: 2, loops: 2 },
    { section: 3, loops: 4 },
    { section: 4, loops: 4 },
    { section: 5, loops: 2 },
    { section: 6, loops: 2 },
    { section: 5, loops: 2 },
    { section: 6, loops: 2 },
    { section: 7, loops: 3 },
    { section: 8, loops: 4 },
    { section: 9, loops: 6 },
    { section: 10, loops: 3 },
    { section: 11, loops: 1 },
  ],
};

const GEMINI_MARCH_TRACK: TrackDef = {
  id: 'geminis-march',
  name: "Gemini's March",
  emoji: '🦾',
  bpm: 130,
  swing: 0.15,
  jitter: 0.003,
  mainSection: 1,
  mainLoops: 15,
  altLoops: { min: 4, max: 8 },
  drums: {
    kick: { start: 220, end: 25, dur: 0.38, gain: 1.1, type: 'sine' },
    snare: { noiseGain: 0.6, filter: 2800, bodyGain: 0.35, bodyStart: 230, bodyEnd: 75 },
    hh: { closedGain: 0.04, openGain: 0.1 },
    rattle: { gain: 0.22, filter: 3400 },
  },
  bass: { gain: 0.38, fStart: 750, fEnd: 140, q: 3 },
  neuBass: { gain: 0.42, fStart: 1600, fEnd: 950, q: 7, detune: 12, lfoDepth: 1200, lfoRate: 0 },
  stab: { gain: 0.38, fStart: 850, fEnd: 150, q: 1.5, type: 'sawtooth', dur: 0.26, detune: 8, vibrato: 0.006, filter: 'lowpass' },
  chug: { gain: 0.38, fStart: 550, fEnd: 110, q: 6, type: 'square', dur: 0.08 },
  tom: { gain: 0.4, sweep: 0.12, ring: 0.22 },
  crash: { gain: 0.32 },
  sections: [
    { kick: hmKick1, bassA: imDroneA, bassB: imDroneB, stab: imStDrn, chug: imChgIdle, tom: imTom0, crash: imCsh1, roll: imRoll0 },
    { kick: hmKick0, bassA: hmA0, bassB: hmB0, stab: hmSta0, chug: hmChg0, tom: hmTom0, crash: imCsh0, roll: imRoll1 },
    { kick: hmKick2, bassA: hmA2, bassB: hmB2, stab: hmSta2, chug: hmChg2, tom: hmTom2, crash: imCsh2, roll: imRoll2 },
    { kick: KICK_BLAST, bassA: imDrpA, bassB: imDrpB, stab: imStDrpA, chug: imChgDrp, tom: imTomDrp, crash: imCsh0, roll: imRoll3 },
    { kick: hmKick4, bassA: hmA4, bassB: hmB4, stab: hmSta4, chug: hmChg4, tom: hmTom4, crash: hmCsh4, roll: hmRoll4 },
  ],
  timeline: [
    { section: 0, loops: 4 },
    { section: 1, loops: 6 },
    { section: 2, loops: 6 },
    { section: 3, loops: 8 },
    { section: 4, loops: 6 },
    { section: 3, loops: 6 },
    { section: 4, loops: 4 },
    { section: 0, loops: 2 },
  ],
};

export const BIG_PICKLE_TRACKS: TrackDef[] = [
  INDUSTRIAL_TRACK,
  FATALITY_TRACK,
  RIP_AND_TEAR_TRACK,
  VOID_PRISM_TRACK,
  HELL_MARCH_TRACK,
  IRON_MARCH_TRACK,
  FOR_AIUR_TRACK,
];

export const GEMINI_TRACKS: TrackDef[] = [
  GEMINI_MARCH_TRACK,
  ...BIG_PICKLE_TRACKS.map((t, idx) => ({
    ...t,
    id: `${t.id}-gemini`,
    name: `${t.name} (g)`,
    bpm: t.bpm + 6 + (idx * 2),
    drums: {
      ...t.drums,
      kick: { ...t.drums.kick, gain: t.drums.kick.gain * 1.05 },
    },
  })),
];