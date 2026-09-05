<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  (e: 'complete'): void;
  (e: 'close'): void;
}>();

const currentStep = ref<number>(0);

const steps = [
  {
    icon: '⚡',
    title: 'Welcome, Zealot Warrior',
    body: 'Welcome to Probes vs Zealot 2: Clicker Wars! You are a mighty Zealot. Your mission: destroy enemy Probe bases, smash their defenses, and claim their minerals.',
  },
  {
    icon: '👆',
    title: 'Attack the Probe Wall',
    body: 'Click on the Probe Wall to attack! Each click deals damage based on your attack power. Destroy the Wall to defeat the defending Probe and advance to the next Rank.',
  },
  {
    icon: '💎',
    title: 'Damage = Income',
    body: 'Your damage IS your income! Every point of damage you deal earns you 1 mineral. Spend those minerals on powerful items in the shop to grow even stronger.',
  },
  {
    icon: '🛒',
    title: 'Shop & Equipment',
    body: 'Visit the Zealot Shop to buy Blades (damage), Gloves (speed), Armors (defense), Amulets (health), and Potions (regen). You have 6 equipment slots — equip the right items to dominate.',
  },
];

const totalSteps = steps.length;
const isLastStep = () => currentStep.value === totalSteps - 1;

function nextStep() {
  if (isLastStep()) {
    emit('complete');
  } else {
    currentStep.value++;
  }
}

function previousStep() {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}
</script>

<template>
  <div class="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60] overflow-y-auto p-4 flex items-center justify-center">
    <div class="bg-gray-900 border-2 border-cyan-500 rounded-xl p-6 max-w-lg w-full text-cyan-100 shadow-2xl shadow-cyan-500/25 my-auto">
      <!-- Header -->
      <div class="flex justify-between items-center border-b border-cyan-800 pb-4 mb-4">
        <div class="flex items-center space-x-2">
          <span class="text-2xl">{{ steps[currentStep].icon }}</span>
          <h2 class="text-xl font-bold tracking-wider text-amber-400">
            QUICK START GUIDE
          </h2>
        </div>
        <button
          @click="emit('close')"
          class="text-gray-400 hover:text-white font-bold text-lg px-2 py-1 rounded transition-colors cursor-pointer"
          title="Close tutorial"
        >
          ✕
        </button>
      </div>

      <!-- Step content -->
      <div class="mb-6">
        <h3 class="text-lg font-bold text-cyan-300 mb-2">
          {{ steps[currentStep].title }}
        </h3>
        <p class="text-sm text-gray-300 leading-relaxed">
          {{ steps[currentStep].body }}
        </p>
      </div>

      <!-- Progress dots -->
      <div class="flex items-center justify-center space-x-2 mb-5">
        <span
          v-for="(_, index) in steps"
          :key="index"
          class="w-2.5 h-2.5 rounded-full transition-all"
          :class="index === currentStep ? 'bg-cyan-400 w-5' : 'bg-gray-700'"
        ></span>
      </div>

      <!-- Controls -->
      <div class="flex justify-between items-center">
        <button
          v-if="currentStep > 0"
          @click="previousStep"
          class="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-4 py-2 rounded text-xs transition-colors cursor-pointer"
        >
          ◀ BACK
        </button>
        <span v-else></span>

        <button
          @click="nextStep"
          class="bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-3 rounded-lg shadow-lg shadow-amber-600/30 transition-all text-sm tracking-wider cursor-pointer"
        >
          {{ isLastStep ? '⚡ BEGIN YOUR JOURNEY!' : 'NEXT ▶' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
