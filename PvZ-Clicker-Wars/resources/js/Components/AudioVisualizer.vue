<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { MAX_VISUAL_BARS } from '../utils/trackVisuals';

interface Props {
  getSectionFrames: (sectionIdx: number) => Float32Array[] | null;
  section: number;
  step: number;
  tick: number;
  active: boolean;
}

const props = defineProps<Props>();

const canvasRef = ref<HTMLCanvasElement | null>(null);

let ctx: CanvasRenderingContext2D | null = null;
let gradients: CanvasGradient[] = [];
let barCount = MAX_VISUAL_BARS;
let lastDrawnFrame: Float32Array | null = null;

function syncCanvasSize() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  // Low-resolution internal buffer to keep fills cheap on mobile.
  const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.6;
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
  gradients = new Array(barCount);
  for (let i = 0; i < barCount; i++) {
    const ratio = i / barCount;
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
  if (lastDrawnFrame) drawFrame(lastDrawnFrame);
}

function drawFrame(frame: Float32Array) {
  const canvas = canvasRef.value;
  if (!canvas || !ctx) return;
  lastDrawnFrame = frame;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const maxHeight = h * 0.6;
  const baseY = h;
  const gap = 2;
  const barWidth = Math.max(1, (w - gap * (barCount - 1)) / barCount);

  for (let i = 0; i < barCount; i++) {
    const value = Math.max(0, Math.min(1, i < frame.length ? frame[i] : 0));
    const barHeight = Math.max(2, value * maxHeight);
    const x = i * (barWidth + gap);
    ctx.fillStyle = gradients[i];
    ctx.fillRect(x, baseY - barHeight, barWidth, barHeight);
  }
}

function renderCurrent() {
  if (!props.active) return;
  const frames = props.getSectionFrames(props.section);
  if (!frames) return;
  const idx = Math.max(0, Math.min(frames.length - 1, props.step));
  drawFrame(frames[idx]);
}

// The audio engine is the source of truth: redraw on each scheduled 8th-note.
// We watch the monotonic `tick` (never repeats) so step wrap-around always redraws.
watch(() => props.tick, renderCurrent);

watch(() => props.active, (active) => {
  if (active) {
    renderCurrent();
  } else {
    const canvas = canvasRef.value;
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastDrawnFrame = null;
  }
});

onMounted(() => {
  ctx = canvasRef.value?.getContext('2d') ?? null;
  syncCanvasSize();
  window.addEventListener('resize', handleResize);
  renderCurrent();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
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
