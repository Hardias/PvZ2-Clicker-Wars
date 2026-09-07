<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  secondsRemaining: number;
}

const props = defineProps<Props>();

const active = computed(() => props.secondsRemaining > 0);
</script>

<template>
  <div v-if="active"
    class="w-full bg-indigo-950/80 px-3 py-1.5 rounded border border-indigo-400/60 text-xs flex items-center justify-center gap-2 animate-pulse">
    <span class="text-indigo-300 text-sm font-bold">🛡️</span>
    <span class="text-indigo-200 font-bold">ABILITY IMMUNITY ACTIVE</span>
    <span class="font-mono text-indigo-300">{{ secondsRemaining }}s</span>
  </div>
</template>

<style scoped>
</style>