<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  comboCount: number;
  comboMax: number;
  multiplier: number;
}

const props = defineProps<Props>();

const label = computed(() => `COMBO ${props.comboCount}`);
const multiText = computed(() => `${props.multiplier.toFixed(2)}x`);
const progress = computed(() =>
  Math.min(100, Math.max(0, (props.comboCount / props.comboMax) * 100))
);
</script>

<template>
  <div class="w-full bg-gray-900/80 px-3 py-2 rounded border border-cyan-700/40 text-xs flex flex-col items-center"
    :class="comboCount > 0 ? 'border-amber-500/60 shadow-amber-950/40' : ''">
    <div class="flex justify-between w-full font-bold mb-1">
      <span class="text-amber-300" :class="comboCount > 0 ? 'animate-pulse' : ''">{{ label }}</span>
      <span class="font-mono text-cyan-300">{{ multiText }}</span>
    </div>
    <div class="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden border border-amber-700/40">
      <div class="bg-gradient-to-r from-amber-700 to-amber-400 h-full transition-all duration-150"
        :style="{ width: `${progress}%` }"></div>
    </div>
  </div>
</template>

<style scoped>
</style>