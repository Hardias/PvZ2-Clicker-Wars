<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface Props {
  getFrequencyData: () => Uint8Array | null;
  active: boolean;
}

const props = defineProps<Props>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let animFrame: number | null = null;

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Resize canvas to fill viewport
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  const w = canvas.width;
  const h = canvas.height;

  // Clear
  ctx.clearRect(0, 0, w, h);

  if (!props.active) {
    animFrame = requestAnimationFrame(draw);
    return;
  }

  const data = props.getFrequencyData();
  if (!data) {
    animFrame = requestAnimationFrame(draw);
    return;
  }

  const barCount = data.length;
  const gap = 2;
  const barWidth = (w - gap * (barCount - 1)) / barCount;
  const maxHeight = h * 0.6;
  const baseY = h;

  for (let i = 0; i < barCount; i++) {
    const value = data[i] / 255;
    const barHeight = Math.max(2, value * maxHeight);

    // Color: cyan to green gradient based on frequency position
    const ratio = i / barCount;
    const r = Math.round(0 + ratio * 0);
    const g = Math.round(200 + ratio * 55);
    const b = Math.round(255 - ratio * 100);
    const alpha = 0.15 + value * 0.35;

    const x = i * (barWidth + gap);
    const y = baseY - barHeight;

    // Glow effect
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
    ctx.shadowBlur = 8;

    // Bar gradient
    const grad = ctx.createLinearGradient(x, baseY, x, y);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${alpha})`);

    ctx.fillStyle = grad;
    ctx.fillRect(x, y, barWidth, barHeight);
  }

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  animFrame = requestAnimationFrame(draw);
}

onMounted(() => {
  animFrame = requestAnimationFrame(draw);
});

onUnmounted(() => {
  if (animFrame) cancelAnimationFrame(animFrame);
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
