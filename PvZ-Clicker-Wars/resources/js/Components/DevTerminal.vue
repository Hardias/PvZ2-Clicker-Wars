<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue';

export interface DevActions {
  grantVespene: () => void;
  hardReset: () => void;
  rankup: (times: number) => void;
}

interface Props {
  actions: DevActions;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
}>();

const lines = ref<string[]>([]);
const currentInput = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const logRef = ref<HTMLDivElement | null>(null);

type PendingPrompt = 'rankupConfirm' | 'rankupTimes' | 'helpConfirm' | null;
const pending = ref<PendingPrompt>(null);

const commandsHelp: string[] = [
  '"abracadabra" - infinite Vespene gas for the Zealot',
  '"reset" - reset the world (keeps inventory & resources)',
  '"rankup" - raise wall rank and shop items',
  '"help" - show this list',
];

function append(line: string) {
  lines.value.push(line);
}

function focusInput() {
  nextTick(() => inputRef.value?.focus());
}

watch(lines, () => {
  nextTick(() => {
    if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight;
  });
});

onMounted(() => {
  lines.value = ['Greetings mighty one, how may we serve?'];
  pending.value = null;
  focusInput();
});

function handleSubmit() {
  const raw = currentInput.value.trim();
  currentInput.value = '';
  if (!raw) return;
  append('> ' + raw);

  switch (pending.value) {
    case 'rankupConfirm':
      if (/^y(es)?$/i.test(raw)) {
        pending.value = 'rankupTimes';
        append('how many times');
      } else if (/^n(o)?$/i.test(raw)) {
        pending.value = null;
        append('Very well, mighty one.');
      } else {
        append('Power granted mighty one, should i repeat this? (Y/N)?');
      }
      return;
    case 'rankupTimes':
      if (/^\d+$/.test(raw)) {
        props.actions.rankup(Math.max(1, parseInt(raw, 10)));
        pending.value = null;
        append('Wow');
      } else {
        append('how many times');
      }
      return;
    case 'helpConfirm':
      pending.value = null;
      if (/^y(es)?$/i.test(raw)) {
        commandsHelp.forEach(c => append(c));
      }
      return;
    default:
      break;
  }

  const cmd = raw.toLowerCase();
  switch (cmd) {
    case 'abracadabra':
      props.actions.grantVespene();
      append('Wish granted mighty one!');
      break;
    case 'reset':
      props.actions.hardReset();
      append('You are to mighty mighty one i cant reset you, but the rest is easy and done..');
      break;
    case 'rankup':
      pending.value = 'rankupConfirm';
      append('Power granted mighty one, should i repeat this? (Y/N)?');
      break;
    case 'help':
      pending.value = 'helpConfirm';
      append('Ow mighty one are we forgetfull today?');
      break;
    default:
      append('I do not understand, mighty one.');
      break;
  }
  focusInput();
}
</script>

<template>
  <div class="fixed bottom-[calc(env(safe-area-inset-bottom)+4rem)] left-3 right-3 sm:left-4 sm:right-auto z-50 w-auto sm:w-[420px] sm:max-w-[calc(100vw-2rem)] bg-black border-2 border-green-600 rounded-lg shadow-2xl shadow-green-900/50 font-mono overflow-hidden">
    <!-- Terminal Header Bar -->
    <div class="flex justify-between items-center bg-gray-900 border-b border-green-800 px-3 py-1.5">
      <span class="text-[10px] font-bold text-green-500 tracking-widest uppercase">DEV TERMINAL</span>
      <button @click="emit('close')" class="text-green-400 hover:text-red-400 text-xs font-bold px-1.5 cursor-pointer" title="Close terminal">
        [ X ]
      </button>
    </div>

    <!-- Terminal Log -->
    <div ref="logRef" class="h-64 overflow-y-auto px-3 py-2 text-green-400 text-xs leading-relaxed whitespace-pre-wrap break-words">
      <div v-for="(line, idx) in lines" :key="idx">{{ line }}</div>
    </div>

    <!-- Prompt Line -->
    <div class="flex items-center px-3 py-2 border-t border-green-800 bg-gray-950">
      <span class="text-green-400 font-bold mr-2">&gt;</span>
      <input
        ref="inputRef"
        v-model="currentInput"
        type="text"
        class="flex-1 bg-transparent outline-none text-green-300 placeholder-green-700 text-xs"
        placeholder="type a command..."
        spellcheck="false"
        autocomplete="off"
        @keydown.enter="handleSubmit"
      />
    </div>
  </div>
</template>

<style scoped>
input {
  caret-color: #22c55e;
}
</style>