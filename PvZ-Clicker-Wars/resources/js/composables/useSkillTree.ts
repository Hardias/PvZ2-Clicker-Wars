import { ref, computed } from 'vue';
import {
  SkillNode,
  SkillTreeState,
  SkillBonuses,
  SkillBranch,
  SKILL_NODES,
  DEFAULT_SKILL_BONUSES,
} from '../types/SkillTree';

/**
 * Composable managing the passive skill tree: 3 branches x 7 nodes.
 * Players earn Zealot XP through kills and spend it to unlock permanent upgrades.
 */

/** Fresh skill tree state (single source of truth for a brand-new tree). */
export function createDefaultSkillTreeState(): SkillTreeState {
  return {
    unlockedNodes: [],
    xp: 0,
    spentXp: 0,
  };
}

export function useSkillTree() {
  const state = ref<SkillTreeState>(createDefaultSkillTreeState());

  const availableXp = computed(() => state.value.xp - state.value.spentXp);
  const totalXp = computed(() => state.value.xp);

  /** Check if a specific node is unlocked */
  function isNodeUnlocked(nodeId: string): boolean {
    return state.value.unlockedNodes.includes(nodeId);
  }

  /** Check if a node can be unlocked (prerequisites met + enough XP) */
  function canUnlockNode(node: SkillNode): boolean {
    if (isNodeUnlocked(node.id)) return false;
    if (node.requiresPrevious) {
      const prevRow = node.row - 1;
      const prevInBranch = SKILL_NODES.find(
        n => n.branch === node.branch && n.row === prevRow
      );
      if (prevInBranch && !isNodeUnlocked(prevInBranch.id)) return false;
    }
    return availableXp.value >= node.cost;
  }

  /** Unlock a skill node */
  function unlockNode(nodeId: string): boolean {
    const node = SKILL_NODES.find(n => n.id === nodeId);
    if (!node || !canUnlockNode(node)) return false;
    state.value.unlockedNodes.push(nodeId);
    state.value.spentXp += node.cost;
    return true;
  }

  /** Grant XP to the zealot */
  function grantXp(amount: number) {
    state.value.xp += Math.max(0, Math.floor(amount));
  }

  /** Compute all bonuses from unlocked nodes */
  const bonuses = computed<SkillBonuses>(() => {
    const b = { ...DEFAULT_SKILL_BONUSES };
    const unlocked = state.value.unlockedNodes;

    // Vengeance
    if (unlocked.includes('v1')) b.damageMultiplier *= 1.15;
    if (unlocked.includes('v2')) b.attackSpeedMultiplier *= 1.10;
    if (unlocked.includes('v3')) { b.critChance += 0.08; b.critMultiplier = 2.0; }
    if (unlocked.includes('v4')) b.damageMultiplier *= 1.25;
    if (unlocked.includes('v5')) b.critChance += 0.12;
    if (unlocked.includes('v6')) b.comboMaxBonus += 25;
    if (unlocked.includes('v7')) { b.critMultiplier = 3.0; b.damageMultiplier *= 1.40; }

    // Resilience
    if (unlocked.includes('r1')) b.maxHpMultiplier *= 1.40;
    if (unlocked.includes('r2')) b.hpRegenPercent += 0.02;
    if (unlocked.includes('r3')) b.turretDamageReduction += 0.15;
    if (unlocked.includes('r4')) b.extraTeleports += 1;
    if (unlocked.includes('r5')) { b.maxHpMultiplier *= 1.30; b.turretDamageReduction += 0.10; }
    if (unlocked.includes('r6')) b.thornsReflect += 0.25;
    if (unlocked.includes('r7')) b.undyingEnabled = true;

    // Wealth (Vespene Titans)
    if (unlocked.includes('w1')) b.vespeneConversionMultiplier *= 2.0;
    if (unlocked.includes('w2')) b.killBountyPercent += 0.03;
    if (unlocked.includes('w3')) b.autoVespenePercent += 0.05;
    if (unlocked.includes('w4')) b.vespeneBountyPercent += 0.03;
    if (unlocked.includes('w5')) b.shopPriceReduction += 0.25;
    if (unlocked.includes('w6')) b.vespeneItemDiscount += 0.30;
    if (unlocked.includes('w7')) { b.vespeneConversionMultiplier *= 2.0; b.killBountyPercent += 0.06; }

    return b;
  });

  /** Deserialize and restore saved state */
  function deserialize(saved: SkillTreeState) {
    state.value = {
      unlockedNodes: Array.isArray(saved?.unlockedNodes) ? [...saved.unlockedNodes] : [],
      xp: typeof saved?.xp === 'number' ? saved.xp : 0,
      spentXp: typeof saved?.spentXp === 'number' ? saved.spentXp : 0,
    };
  }

  /** Reset the skill tree to a fresh state (all XP and unlocks removed) */
  function reset() {
    state.value = createDefaultSkillTreeState();
  }

  /** Get XP required for next unlock in a branch */
  function getNextCost(branch: SkillBranch): number | null {
    const branchNodes = SKILL_NODES.filter(n => n.branch === branch);
    for (const node of branchNodes) {
      if (!isNodeUnlocked(node.id)) return node.cost;
    }
    return null;
  }

  return {
    state,
    availableXp,
    totalXp,
    bonuses,
    isNodeUnlocked,
    canUnlockNode,
    unlockNode,
    grantXp,
    getNextCost,
    deserialize,
    reset,
  };
}
