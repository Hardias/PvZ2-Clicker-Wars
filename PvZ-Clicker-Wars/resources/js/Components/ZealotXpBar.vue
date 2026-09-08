<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  talentPoints: number;
}

const props = defineProps<Props>();

const progress = computed(() => {
  if (!props.xpForNext || props.xpForNext <= 0) return 100;
  return Math.min(100, Math.max(0, (props.xpIntoLevel / props.xpForNext) * 100));
});

const progressLabel = computed(() =>
  `${props.xpIntoLevel.toLocaleString()} / ${props.xpForNext.toLocaleString()} XP`,
);
</script>

<template>
  <div class="mt-4 bg-gray-950/70 rounded-lg border border-cyan-900/40 p-3">
    <div class="flex justify-between items-center mb-1.5 text-xs">
      <span class="font-bold text-amber-300 tracking-wider">⚡ ZEALOT · LVL {{ level }}</span>
      <span class="font-mono text-amber-200">{{ progressLabel }}</span>
    </div>
    <div class="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden border border-amber-800/40">
      <div class="bg-gradient-to-r from-amber-700 to-amber-400 h-full transition-all duration-300"
        :style="{ width: `${progress}%` }"></div>
    </div>
    <div class="flex justify-between items-center mt-1">
      <span class="text-[10px] text-gray-500">Earn XP by destroying walls and probes.</span>
      <span
        class="text-[10px] font-black rounded-full px-2 py-0.5 transition-colors"
        :class="talentPoints > 0
          ? 'bg-amber-400 text-black border border-amber-200 shadow shadow-amber-500/40'
          : 'bg-gray-900 text-gray-500 border border-gray-700'"
      >
        ✦ {{ talentPoints }} TALENT {{ talentPoints === 1 ? 'PT' : 'PTS' }}
      </span>
    </div>
  </div>
</template>