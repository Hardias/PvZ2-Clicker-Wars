import { ref, computed } from 'vue';

const COMBO_TIMEOUT_MS = 1200;
const BASE_COMBO_MAX = 50;
const COMBO_MULTIPLIER_PER_LEVEL = 0.04;

/**
 * Composable tracking rapid-click combo multiplier.
 * Each click within the timeout window increases the combo counter.
 * Combo resets on timeout, damage taken, wall destruction, or immobilization.
 */
export function useCombo() {
  const comboCount = ref(0);
  let lastClickTime = 0;
  let timeoutId: number | null = null;

  const comboMax = ref(BASE_COMBO_MAX);

  const comboMultiplier = computed(() => {
    return 1.0 + comboCount.value * COMBO_MULTIPLIER_PER_LEVEL;
  });

  /** Set a new max combo limit (used by skill tree nodes) */
  function setMaxCombo(value: number) {
    comboMax.value = value;
  }

  /** Register a combo-triggering click (manual attack or auto-attack) — increases combo and resets the decay timer */
  function registerClick() {
    const now = Date.now();
    if (now - lastClickTime <= COMBO_TIMEOUT_MS) {
      comboCount.value = Math.min(comboMax.value, comboCount.value + 1);
    } else {
      comboCount.value = 1;
    }
    lastClickTime = now;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => {
      comboCount.value = 0;
      timeoutId = null;
    }, COMBO_TIMEOUT_MS);
  }

  /** Register damage taken — resets combo */
  function registerDamageTaken() {
    if (comboCount.value > 0) {
      comboCount.value = 0;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  }

  /** Register wall destroyed — resets combo for fresh start */
  function registerWallDestroyed() {
    if (comboCount.value > 0) {
      comboCount.value = 0;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  }

  /** Force-reset combo (e.g. on immobilize) */
  function resetCombo() {
    comboCount.value = 0;
    lastClickTime = 0;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  return {
    comboCount,
    comboMultiplier,
    comboMax,
    setMaxCombo,
    registerClick,
    registerDamageTaken,
    registerWallDestroyed,
    resetCombo,
  };
}
