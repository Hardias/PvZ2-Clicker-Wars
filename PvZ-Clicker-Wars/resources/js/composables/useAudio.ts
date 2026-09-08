import { ref, computed, onUnmounted } from 'vue';
import type { AudioNodes, SfxName, TrackDef } from '../audio/types';
import { BIG_PICKLE_TRACKS, GEMINI_TRACKS, snarePattern, hhPattern } from '../audio/trackCatalog';
import { playKick, playSnare, playHiHat, playRattle, playBass, playNeuroBass, playStab, playChug, playTom, playCrash } from '../audio/synths';
import { playSfxSound } from '../audio/sfx';
import {
  MUSIC_VOLUME_KEY,
  SFX_VOLUME_KEY,
  MUSIC_MUTED_KEY,
  SFX_MUTED_KEY,
  VISUALIZER_ENABLED_KEY,
  MUSIC_TRACK_KEY,
  TRACK_PACK_KEY,
} from '../utils/keys';

// Loads a 0..1 volume value from localStorage with a sensible fallback.
function loadNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw !== null) {
    const n = parseFloat(raw);
    if (!isNaN(n) && n >= 0 && n <= 1) return n;
  }
  return fallback;
}

// Loads a boolean pref from localStorage with a sensible fallback.
function loadBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

export function useAudio() {
  const musicVolume = ref(loadNumber(MUSIC_VOLUME_KEY, 0.4));
  const sfxVolume = ref(loadNumber(SFX_VOLUME_KEY, 0.5));
  const musicMuted = ref(loadBool(MUSIC_MUTED_KEY, false));
  const sfxMuted = ref(loadBool(SFX_MUTED_KEY, false));
  const visualizerEnabled = ref(loadBool(VISUALIZER_ENABLED_KEY, true));
  const isPlaying = ref(false);

  let ctx: AudioContext | null = null;
  let nodes: AudioNodes | null = null;
  let musicNodes: OscillatorNode[] = [];
  let noiseNode: AudioBufferSourceNode | null = null;
  let musicInterval: number | null = null;
  let initialized = false;

  // Lazily creates (and resumes) the shared AudioContext — it must be unlocked
  // by a user gesture before any sound can play.
  function ensureContext(): AudioContext {
    if (!ctx || ctx.state === 'closed') {
      ctx = new AudioContext();
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  // Builds the master audio graph once: music/sfx buses, glue compressor and the
  // analyser that feeds the visualizer.
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

  // ──────────────────────────────────────────────────────────────────────
  // Music engine — track data lives in audio/trackCatalog.ts, the synth
  // voices in audio/synths.ts. This composable only drives the scheduler
  // state machine and the audio graph + persistence.
  // ──────────────────────────────────────────────────────────────────────

  let beatTimer: number | null = null;
  let currentStep = 0;
  let currentSectionIdx = 0;
  let sectionStepsLeft = 1;
  let songCtx: AudioContext | null = null;
  let songDest: GainNode | null = null;
  let timelinePos = 0;

  // Restores the saved track index, clamped to the current catalog size.
  function loadTrackIndex(): number {
    const raw = localStorage.getItem(MUSIC_TRACK_KEY);
    if (raw !== null) {
      const n = parseInt(raw, 10);
      if (!isNaN(n) && n >= 0 && n < BIG_PICKLE_TRACKS.length) return n;
    }
    return 0;
  }

  // Restores the saved track pack ('big_pickle' | 'gemini').
  function loadTrackPack(): 'big_pickle' | 'gemini' {
    const raw = localStorage.getItem(TRACK_PACK_KEY);
    if (raw === 'gemini' || raw === 'big_pickle') return raw;
    return 'big_pickle';
  }

  const trackPack = ref<'big_pickle' | 'gemini'>(loadTrackPack());

  const TRACKS = computed<TrackDef[]>(() => {
    return trackPack.value === 'gemini' ? GEMINI_TRACKS : BIG_PICKLE_TRACKS;
  });

  const trackIndex = ref(loadTrackIndex());
  const currentTrackName = computed<string>(() => TRACKS.value[trackIndex.value]?.name ?? TRACKS.value[0].name);
  const currentTrackEmoji = computed<string>(() => TRACKS.value[trackIndex.value]?.emoji ?? TRACKS.value[0].emoji);

  // Switches packs mid-session, stopping and restarting music if it was playing.
  function setTrackPack(pack: 'big_pickle' | 'gemini') {
    const wasPlaying = isPlaying.value && !musicMuted.value;
    if (wasPlaying) stopMusic();
    trackPack.value = pack;
    localStorage.setItem(TRACK_PACK_KEY, pack);
    const active = pack === 'gemini' ? GEMINI_TRACKS : BIG_PICKLE_TRACKS;
    if (trackIndex.value >= active.length) {
      trackIndex.value = 0;
    }
    if (wasPlaying) startMusic();
  }

  // ── Track-aware scheduler state machine ───────────────────────────
  // Enters a section: sets the loop budget to mainLoops (for the main section)
  // or a randomized alt-loop count.
  function enterSection(idx: number) {
    const track = TRACKS.value[trackIndex.value];
    currentSectionIdx = idx;
    sectionStepsLeft = idx === track.mainSection
      ? track.mainLoops
      : track.altLoops.min + Math.floor(Math.random() * (track.altLoops.max - track.altLoops.min + 1));
  }

  // One 8th-note tick: plays the drums, rattle, stab, chug, tom, crash and bass
  // (or neuro bass) pattern of the current step, then advances and rolls over
  // to the next section/timeline entry.
  function schedulerTick() {
    if (!songCtx || !songDest || musicMuted.value) return;

    const audio = songCtx;
    const dest = songDest;
    const step = currentStep % 16;
    const time = audio.currentTime + 0.05;

    const track = TRACKS.value[trackIndex.value];
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

  // Boots the step sequencer and starts the interval timer for the current track.
  function startMusic() {
    if (isPlaying.value) return;
    const audio = ensureContext();
    const { musicGain } = ensureNodes();

    songCtx = audio;
    songDest = musicGain;
    currentStep = 0;
    const track = TRACKS.value[trackIndex.value];
    if (track.timeline && track.timeline.length > 0) {
      timelinePos = 0;
      const entry = track.timeline[0];
      currentSectionIdx = entry.section;
      sectionStepsLeft = entry.loops;
    } else {
      enterSection(track.mainSection);
    }

    const stepDur = 60 / TRACKS.value[trackIndex.value].bpm / 2 * 1000;
    beatTimer = window.setInterval(schedulerTick, stepDur);
    isPlaying.value = true;
  }

  // Halts the scheduler and silences any hanging oscillator/noise voices.
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

  // Advances to the next catalog track (wrapping around) and persists the index.
  function nextTrack() {
    const wasPlaying = isPlaying.value && !musicMuted.value;
    if (wasPlaying) stopMusic();
    trackIndex.value = (trackIndex.value + 1) % TRACKS.value.length;
    localStorage.setItem(MUSIC_TRACK_KEY, String(trackIndex.value));
    if (wasPlaying) startMusic();
  }

  // ─── Sound Effects ────────────────────────────────────────────────

  // Fires a one-shot sound effect through the SFX bus.
  function playSfx(name: SfxName) {
    if (sfxMuted.value) return;
    const audio = ensureContext();
    const { sfxGain } = ensureNodes();
    playSfxSound(name, audio, sfxGain);
  }

  // ─── Volume / Mute Controls ──────────────────────────────────────

  // Sets + persists the music bus volume, applied live when unmuted.
  function setMusicVolume(v: number) {
    musicVolume.value = Math.max(0, Math.min(1, v));
    localStorage.setItem(MUSIC_VOLUME_KEY, String(musicVolume.value));
    if (nodes && !musicMuted.value) {
      nodes.musicGain.gain.setValueAtTime(musicVolume.value, ctx?.currentTime ?? 0);
    }
  }

  // Sets + persists the SFX bus volume, applied live when unmuted.
  function setSfxVolume(v: number) {
    sfxVolume.value = Math.max(0, Math.min(1, v));
    localStorage.setItem(SFX_VOLUME_KEY, String(sfxVolume.value));
    if (nodes && !sfxMuted.value) {
      nodes.sfxGain.gain.setValueAtTime(sfxVolume.value, ctx?.currentTime ?? 0);
    }
  }

  // Mutes/unmutes music; unmuting (re)starts the sequencer since autoplay
  // requires a user gesture.
  function toggleMusicMute() {
    musicMuted.value = !musicMuted.value;
    localStorage.setItem(MUSIC_MUTED_KEY, String(musicMuted.value));
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

  // Mutes/unmutes the SFX bus.
  function toggleSfxMute() {
    sfxMuted.value = !sfxMuted.value;
    localStorage.setItem(SFX_MUTED_KEY, String(sfxMuted.value));
    if (nodes) {
      nodes.sfxGain.gain.setValueAtTime(
        sfxMuted.value ? 0 : sfxVolume.value,
        ctx?.currentTime ?? 0
      );
    }
  }

  // First user-gesture hook: unlocks the audio graph and starts music if enabled.
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

  // Live FFT snapshot for the visualizer (null when disabled/muted).
  function getFrequencyData(): Uint8Array | null {
    if (!nodes || musicMuted.value || !visualizerEnabled.value) return null;
    nodes.analyser.getByteFrequencyData(nodes.freqData);
    return nodes.freqData;
  }

  // Toggles visualizer rendering and persists the pref.
  function toggleVisualizer() {
    visualizerEnabled.value = !visualizerEnabled.value;
    localStorage.setItem(VISUALIZER_ENABLED_KEY, String(visualizerEnabled.value));
  }

  // Sets visualizer rendering state and persists the pref.
  function setVisualizer(enabled: boolean) {
    visualizerEnabled.value = enabled;
    localStorage.setItem(VISUALIZER_ENABLED_KEY, String(visualizerEnabled.value));
  }

  return {
    musicVolume,
    sfxVolume,
    musicMuted,
    sfxMuted,
    visualizerEnabled,
    isPlaying,
    currentTrackName,
    currentTrackEmoji,
    trackPack,
    setTrackPack,
    startMusic,
    stopMusic,
    nextTrack,
    playSfx,
    setMusicVolume,
    setSfxVolume,
    toggleMusicMute,
    toggleSfxMute,
    toggleVisualizer,
    setVisualizer,
    initOnInteraction,
    getFrequencyData,
  };
}