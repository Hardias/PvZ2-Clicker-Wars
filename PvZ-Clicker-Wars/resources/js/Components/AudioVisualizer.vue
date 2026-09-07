<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';

type QualityMode = 'auto' | 'mobile' | 'desktop';
type EffectiveTier = 'mobile' | 'desktop';

interface Props {
  getFrequencyData: () => Uint8Array | null;
  active: boolean;
  qualityMode?: QualityMode;
}

const props = withDefaults(defineProps<Props>(), { qualityMode: 'auto' });

const canvasRef = ref<HTMLCanvasElement | null>(null);

const MAX_BARS = 96;
// Mobile tier: cheap, decimated FFT reads, tweened smoothly in between.
const SAMPLE_INTERVAL_MS = 125; // ~8Hz
const LOW_FPS = 30;
const LOW_FPS_INTERVAL_MS = 1000 / LOW_FPS;
// Tailwind `lg:` breakpoint — same point where the desktop 3-column layout kicks in.
const DESKTOP_QUERY = '(min-width: 1024px)';

let ctx: CanvasRenderingContext2D | null = null;
let gradients: CanvasGradient[] = [];
let effectiveTier: EffectiveTier = 'mobile';
let rafId = 0;
let mqCleanup: (() => void) | null = null;
let lastFrame = 0;
let lastSampleTime = 0;
let tweenStart = 0;

// Current snapshot we are tweening to + the values we animate from.
let targetBars = new Float32Array(MAX_BARS);
let fromBars = new Float32Array(MAX_BARS);
// Bars currently on screen (used as the tween starting point).
let renderedBars = new Float32Array(MAX_BARS);
// Decimated frequency data (32 bins -> 96 bars) stored once per sample.
const bins96 = new Float32Array(MAX_BARS);

function syncCanvasSize() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  // Desktop renders at full resolution, mobile uses a low-res buffer.
  const scale = effectiveTier === 'desktop'
    ? Math.min(window.devicePixelRatio || 1, 2)
    : Math.min(window.devicePixelRatio || 1, 1.5) * 0.6;
  const nextW = Math.max(1, Math.round(window.innerWidth * scale));
  const nextH = Math.max(1, Math.round(window.innerHeight * scale));

  if (canvas.width !== nextW || canvas.height !== nextH) {
    canvas.width = nextW;
    canvas.height = nextH;
  }

  prepareGradients();
}

// Prebuilt per-bar gradient so we never allocate them per frame.
function prepareGradients() {
  const canvas = canvasRef.value;
  if (!canvas || !ctx) return;
  gradients = new Array(MAX_BARS);
  for (let i = 0; i < MAX_BARS; i++) {
    const ratio = i / MAX_BARS;
    const g = 200 + ratio * 55;
    const b = 255 - ratio * 100;
    const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
    grad.addColorStop(0, `rgba(0, ${g}, ${b}, ${0.04 + ratio * 0.06})`);
    grad.addColorStop(1, `rgba(0, ${g}, ${b}, 0.5)`);
    gradients[i] = grad;
  }
}

function handleResize() {
  syncCanvasSize();
}

function sampleToBars(data: Uint8Array): void {
  for (let i = 0; i < MAX_BARS; i++) {
    const bin = Math.min(data.length - 1, Math.round((i / MAX_BARS) * (data.length - 1)));
    const v = data[bin] / 255;
    bins96[i] = v;
  }
}

function sampleNow(): void {
  const data = props.getFrequencyData();
  if (!data) return;
  sampleToBars(data);
  lastSampleTime = performance.now();
}

function draw(now: number): void {
  const canvas = canvasRef.value;
  if (!canvas || !ctx) return;

  if (effectiveTier === 'desktop') {
    // Full quality: render the freshly sampled spectrum directly.
    renderedBars.set(bins96);
  } else {
    // Mobile tier: tween from the previous display toward the last snapshot.
    const progress = Math.min(1, (now - tweenStart) / SAMPLE_INTERVAL_MS);
    const eased = progress * progress * (3 - 2 * progress);
    for (let i = 0; i < MAX_BARS; i++) {
      renderedBars[i] = fromBars[i] + (targetBars[i] - fromBars[i]) * eased;
    }
  }

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const maxHeight = h * 0.6;
  const baseY = h;
  const gap = 2;
  const barWidth = Math.max(1, (w - gap * (MAX_BARS - 1)) / MAX_BARS);

  for (let i = 0; i < MAX_BARS; i++) {
    const value = Math.max(0, Math.min(1, renderedBars[i]));
    const barHeight = Math.max(2, value * maxHeight);
    const x = i * (barWidth + gap);
    ctx.fillStyle = gradients[i];
    ctx.fillRect(x, baseY - barHeight, barWidth, barHeight);
  }
}

function tick(now: number): void {
  rafId = 0;
  if (!props.active || document.visibilityState !== 'visible') return;

  if (now - lastFrame >= LOW_FPS_INTERVAL_MS) {
    lastFrame = now;
    if (effectiveTier === 'desktop') {
      // Max version: fresh FFT read every drawn frame (~30Hz).
      sampleNow();
      draw(now);
    } else {
      if (now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
        // Move the tween anchor to what is currently on screen, then sample.
        fromBars.set(renderedBars);
        sampleNow();
        targetBars.set(bins96);
        tweenStart = now;
      }
      draw(now);
    }
  }

  rafId = requestAnimationFrame(tick);
}

function startLoop(): void {
  if (rafId || !props.active || document.visibilityState !== 'visible') return;
  sampleNow();
  draw(performance.now());
  rafId = requestAnimationFrame(tick);
}

function stopLoop(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

function clearCanvas(): void {
  const canvas = canvasRef.value;
  if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function resolveTier(): EffectiveTier {
  if (props.qualityMode === 'desktop') return 'desktop';
  if (props.qualityMode === 'mobile') return 'mobile';
  return window.matchMedia(DESKTOP_QUERY).matches ? 'desktop' : 'mobile';
}

watch(() => props.active, (active) => {
  if (active && document.visibilityState === 'visible') {
    startLoop();
  } else {
    stopLoop();
    if (!active) clearCanvas();
  }
});

watch(() => props.qualityMode, () => onTierChange());

function onVisibilityChange(): void {
  if (props.active && document.visibilityState === 'visible') {
    startLoop();
  } else {
    stopLoop();
  }
}

function onTierChange(): void {
  const next = resolveTier();
  if (next !== effectiveTier) {
    effectiveTier = next;
    syncCanvasSize();
    if (effectiveTier === 'desktop') {
      // Snap straight to a fresh snapshot when switching to desktop quality.
      sampleNow();
    }
  }
}

onMounted(() => {
  ctx = canvasRef.value?.getContext('2d') ?? null;
  effectiveTier = resolveTier();
  syncCanvasSize();
  window.addEventListener('resize', handleResize);
  document.addEventListener('visibilitychange', onVisibilityChange);
  const mq = window.matchMedia(DESKTOP_QUERY);
  if (mq.addEventListener) {
    mq.addEventListener('change', onTierChange);
    mqCleanup = () => mq.removeEventListener('change', onTierChange);
  } else {
    mq.addListener(onTierChange);
    mqCleanup = () => mq.removeListener(onTierChange);
  }
  startLoop();
});

onUnmounted(() => {
  stopLoop();
  window.removeEventListener('resize', handleResize);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  mqCleanup?.();
  mqCleanup = null;
});
</script>

<template>
  <canvas
    ref="canvasRef"
    class="fixed inset-0 pointer-events-none transition-opacity duration-700"
    :class="active ? 'opacity-100' : 'opacity-0'"
    style="z-index: 1;"
  />
</template>

<style scoped>
</style>