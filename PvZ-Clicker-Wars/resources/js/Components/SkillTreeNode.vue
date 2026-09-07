<script setup lang="ts">
import { computed } from 'vue';
import { SkillBranch, SkillNode } from '../types/SkillTree';

interface Props {
  node: SkillNode;
  unlocked: boolean;
  canUnlock: boolean;
  isNextInBranch: boolean;
  selected: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'select', nodeId: string): void;
  (e: 'unlock', nodeId: string): void;
}>();

interface BranchTheme {
  fillUnlocked: string;
  ringUnlocked: string;
  text: string;
  glow: string;
}

const branchTheme: Record<SkillBranch, BranchTheme> = {
  vengeance: {
    fillUnlocked: 'bg-red-950/80 border-red-400',
    ringUnlocked: 'border-red-400',
    text: 'text-red-300',
    glow: 'shadow-red-950/70',
  },
  resilience: {
    fillUnlocked: 'bg-green-950/80 border-green-400',
    ringUnlocked: 'border-green-400',
    text: 'text-green-300',
    glow: 'shadow-green-950/70',
  },
  wealth: {
    fillUnlocked: 'bg-blue-950/80 border-blue-400',
    ringUnlocked: 'border-blue-400',
    text: 'text-blue-300',
    glow: 'shadow-blue-950/70',
  },
};

const theme = computed(() => branchTheme[props.node.branch]);

const boxClass = computed(() => {
  if (props.unlocked) return `bg-gray-800/90 border-2 ${theme.value.ringUnlocked}`;
  if (props.canUnlock) return 'bg-gray-800/95 border-2 border-yellow-400 skill-pulse';
  if (props.isNextInBranch) return 'bg-gray-800/60 border-2 border-amber-600/70';
  return 'bg-gray-900/70 border-2 border-gray-700 opacity-50';
});

const nameClass = computed(() =>
  props.unlocked
    ? `${theme.value.text}`
    : props.canUnlock || props.isNextInBranch
      ? 'text-gray-200'
      : 'text-gray-500',
);
</script>

<template>
  <div
    class="relative flex flex-col items-center justify-center gap-1 rounded-2xl py-3 px-2 cursor-pointer transition-all duration-150 select-none w-full"
    :class="[boxClass, selected ? 'ring-2 ring-white/90 scale-[1.04] z-10' : '', props.unlocked ? 'shadow-lg ' + theme.glow : '']"
    @click="emit('select', node.id)"
  >
    <span class="text-2xl leading-none drop-shadow">{{ node.icon }}</span>
    <span class="text-[9px] font-bold uppercase tracking-wider leading-tight text-center" :class="nameClass">{{ node.name }}</span>

    <span v-if="unlocked"
      class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-emerald-500 border border-emerald-300 text-black text-[10px] font-black flex items-center justify-center shadow">
      ✓
    </span>
    <span v-else-if="!canUnlock && !isNextInBranch"
      class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center text-[9px]">
      🔒
    </span>

    <span class="absolute -top-2 -left-2 text-[9px] font-mono rounded-full bg-gray-950/90 border px-1.5 py-0.5" :class="props.unlocked ? 'border-emerald-500/60 text-emerald-400' : 'border-gray-700 text-gray-500'">
      {{ node.row }}
    </span>

    <button
      v-if="canUnlock"
      class="mt-1 text-[10px] font-black text-black bg-yellow-400 border border-yellow-200 rounded-full px-2.5 py-0.5 transition-colors"
      @click.stop="emit('unlock', node.id)"
    >
      {{ node.cost }}
    </button>
    <span v-else-if="isNextInBranch" class="mt-1 text-[10px] font-bold text-amber-300">{{ node.cost }}</span>
  </div>
</template>

<style scoped>
.skill-pulse {
  box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.6);
  animation: skill-glow 1.6s ease-in-out infinite;
}

@keyframes skill-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.0);
  }
  50% {
    box-shadow: 0 0 14px 2px rgba(250, 204, 21, 0.55);
  }
}
</style>