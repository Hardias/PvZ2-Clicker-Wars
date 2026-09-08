import { ref, computed } from 'vue';
import {
  SkillNode,
  SkillTreeState,
  SkillBonuses,
  SKILL_NODES,
  xpForNextLevel,
  investedPoints,
  canInvestNode,
  computeBonuses,
} from '../types/SkillTree';

/**
 * Composable managing the passive talent tree: 3 branches x 7 rows.
 * Zealots earn XP, level up (1 talent point per level) and spend talent
 * points on rankable talents (1 point per rank, up to maxPoints).
 */

/** Fresh skill tree state (single source of truth for a brand-new tree). */
export function createDefaultSkillTreeState(): SkillTreeState {
  return {
    level: 1,
    xp: 0,
    talentPoints: 0,
    ranks: {},
  };
}

export function useSkillTree() {
  const state = ref<SkillTreeState>(createDefaultSkillTreeState());

  const level = computed(() => state.value.level);
  const talentPoints = computed(() => state.value.talentPoints);
  const xpIntoLevel = computed(() => state.value.xp);
  const xpForNext = computed(() => xpForNextLevel(state.value.level));
  const ranks = computed<Record<string, number>>(() => state.value.ranks);

  const spentPoints = computed(() =>
    SKILL_NODES.reduce((sum, n) => sum + investedPoints(state.value.ranks, n.id), 0),
  );

  /** XP earned in total (through previous levels + current progress). */
  const totalXpEarned = computed(() => {
    let total = state.value.xp;
    for (let lvl = 1; lvl < state.value.level; lvl++) {
      total += xpForNextLevel(lvl);
    }
    return total;
  });

  /** Check how many points are invested in a specific node. */
  function getRank(nodeId: string): number {
    return investedPoints(state.value.ranks, nodeId);
  }

  /** Check if a node can currently accept another talent point. */
  function canInvest(node: SkillNode): boolean {
    return canInvestNode(node, state.value.ranks, state.value.talentPoints);
  }

  /** Invest 1 talent point into a node. */
  function investPoint(nodeId: string): boolean {
    const node = SKILL_NODES.find(n => n.id === nodeId);
    if (!node || !canInvestNode(node, state.value.ranks, state.value.talentPoints)) return false;
    state.value.ranks[nodeId] = (state.value.ranks[nodeId] || 0) + 1;
    state.value.talentPoints -= 1;
    return true;
  }

  /** Grant XP to the zealot; rolls level-ups and awards 1 talent point per level. */
  function grantXp(amount: number) {
    const earned = Math.max(0, Math.floor(amount));
    if (earned === 0) return;
    state.value.xp += earned;
    while (state.value.xp >= xpForNextLevel(state.value.level)) {
      state.value.xp -= xpForNextLevel(state.value.level);
      state.value.level += 1;
      state.value.talentPoints += 1;
    }
  }

  /** Compute all bonuses from invested ranks. */
  const bonuses = computed<SkillBonuses>(() => computeBonuses(state.value.ranks));

  /** Deserialize and restore a saved state. Old/malformed saves fall back to a clean level-1 state. */
  function deserialize(saved: unknown) {
    const s = (saved ?? {}) as Record<string, unknown>;
    if (
      s &&
      typeof s === 'object' &&
      typeof s.ranks === 'object' &&
      s.ranks !== null &&
      typeof s.level === 'number' &&
      typeof s.xp === 'number' &&
      typeof s.talentPoints === 'number'
    ) {
      const ranksParsed: Record<string, number> = {};
      for (const [id, val] of Object.entries(s.ranks as Record<string, unknown>)) {
        const node = SKILL_NODES.find(n => n.id === id);
        if (node && typeof val === 'number' && Number.isFinite(val)) {
          ranksParsed[id] = Math.min(node.maxPoints, Math.max(0, Math.floor(val)));
        }
      }
      state.value = {
        level: Math.max(1, Math.min(1_000_000, Math.floor(s.level))),
        xp: Math.max(0, Math.floor(s.xp)),
        talentPoints: Math.max(0, Math.floor(s.talentPoints)),
        ranks: ranksParsed,
      };
    } else {
      state.value = createDefaultSkillTreeState();
    }
  }

  /** Reset the talent tree to a fresh state (level 1, no points, no ranks). */
  function reset() {
    state.value = createDefaultSkillTreeState();
  }

  /**
   * TIJDELIJK (evaluate before final build): refund every invested point back into the
   * point pool and clear all ranks. Level and XP stay untouched — lets a player switch
   * exclusive (of/of) choices. May need cost/cooldown limits or a permanent-lock later.
   */
  function respec() {
    const refund = spentPoints.value;
    state.value = {
      ...state.value,
      talentPoints: state.value.talentPoints + refund,
      ranks: {},
    };
  }

  return {
    state,
    level,
    talentPoints,
    xpIntoLevel,
    xpForNext,
    ranks,
    spentPoints,
    totalXpEarned,
    bonuses,
    getRank,
    canInvest,
    investPoint,
    grantXp,
    deserialize,
    reset,
    respec,
  };
}