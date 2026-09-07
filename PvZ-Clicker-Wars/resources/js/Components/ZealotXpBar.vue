<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  xp: number;
  spentXp: number;
  nextCost: number | null;
}

const props = defineProps<Props>();

const availableXp = computed(() => Math.max(0, props.xp - props.spentXp));

const progress = computed(() => {
  if (!props.nextCost || props.nextCost <= 0) return 100;
  return Math.min(100, Math.max(0, (availableXp.value / props.nextCost) * 100));
});

const progressLabel = computed(() => {
  if (!props.nextCost) return 'MAXED';
  return `${availableXp.value.toLocaleString()} / ${props.nextCost.toLocaleString()} XP`;
});
</script>

<template>
  <div class="mt-4 bg-gray-950/70 rounded-lg border border-cyan-900/40 p-3">
    <div class="flex justify-between items-center mb-1.5 text-xs">
      <span class="font-bold text-amber-300 tracking-wider">⚡ ZEALOT XP</span>
      <span class="font-mono text-amber-200">{{ progressLabel }}</span>
    </div>
    <div class="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden border border-amber-800/40">
      <div class="bg-gradient-to-r from-amber-700 to-amber-400 h-full transition-all duration-300"
        :style="{ width: `${progress}%` }"></div>
    </div>
    <div class="text-[10px] text-gray-500 mt-1">
      Earn XP by destroying walls and probes. Spend it in the Skill Tree!
    </div>
  </div>
</template>

<style scoped>
</style>