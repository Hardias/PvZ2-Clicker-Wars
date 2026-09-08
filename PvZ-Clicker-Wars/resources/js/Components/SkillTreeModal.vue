<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  SkillBranch,
  SkillNode,
  SKILL_NODES,
  SKILL_BRANCHES,
  MAX_TALENTS_PER_ROW,
  investedPoints,
  canInvestNode,
  isExclusiveLocked,
  hasUnlockedParents,
} from '../types/SkillTree';
import SkillTreeNode from './SkillTreeNode.vue';

interface Props {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  talentPoints: number;
  ranks: Record<string, number>;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'invest', nodeId: string): void;
  (e: 'respec'): void;
  (e: 'close'): void;
}>();

// ── Tree layout constants (shared by node layer + SVG connector layer) ──
const ROW_H = 112;
const VIEW_W = 400;
const SLOT_W = VIEW_W / MAX_TALENTS_PER_ROW;

const branches = computed<SkillBranch[]>(() => ['vengeance', 'resilience', 'wealth']);

const activeBranch = ref<SkillBranch>('vengeance');
const selectedId = ref<string | null>(null);

function nodesFor(branch: SkillBranch): SkillNode[] {
  return SKILL_NODES.filter(n => n.branch === branch);
}

function centerXUnits(node: SkillNode): number {
  return (node.col + 0.5) * SLOT_W;
}

function centerYUnits(node: SkillNode): number {
  return (node.row - 1) * ROW_H + ROW_H / 2;
}

function leftPct(node: SkillNode): number {
  return (centerXUnits(node) / VIEW_W) * 100;
}

function topPx(node: SkillNode): number {
  return centerYUnits(node);
}

function rankOf(nodeId: string): number {
  return investedPoints(props.ranks, nodeId);
}

function canInvest(node: SkillNode): boolean {
  return canInvestNode(node, props.ranks, props.talentPoints);
}

function isLocked(node: SkillNode): boolean {
  return isExclusiveLocked(props.ranks, node);
}

function isReady(node: SkillNode): boolean {
  return hasUnlockedParents(node, props.ranks);
}

const treeHeight = computed(() => 7 * ROW_H);
const treeViewBox = computed(() => `0 0 ${VIEW_W} ${treeHeight.value}`);

interface TreeEdge {
  d: string;
  active: boolean;
}

/** Elbow connectors: parent bottom → half-gap horizontal → child top (a real tree, not a stick). */
function connectorEdges(branch: SkillBranch): TreeEdge[] {
  const nodes = nodesFor(branch);
  const byId = new Map(nodes.map(n => [n.id, n]));
  const edges: TreeEdge[] = [];
  for (const node of nodes) {
    for (const pid of node.parents) {
      const parent = byId.get(pid);
      if (!parent) continue;
      const x1 = centerXUnits(parent);
      const y1 = centerYUnits(parent);
      const x2 = centerXUnits(node);
      const y2 = centerYUnits(node);
      const yMid = y1 + (y2 - y1) * 0.5;
      edges.push({
        d: `M ${x1} ${y1} V ${yMid} H ${x2} V ${y2}`,
        active: rankOf(parent.id) > 0 || rankOf(node.id) > 0,
      });
    }
  }
  return edges;
}

function edgesForActiveBranch(): TreeEdge[] {
  return connectorEdges(activeBranch.value);
}

interface OrChip {
  leftPct: number;
  topPx: number;
}

/** Positioned "─ OR ─" marker between the two siblings of every exclusive pair. */
function exclusiveChips(branch: SkillBranch): OrChip[] {
  const groups = new Map<string, SkillNode[]>();
  for (const n of nodesFor(branch)) {
    if (!n.exclusiveGroup) continue;
    const list = groups.get(n.exclusiveGroup) ?? [];
    list.push(n);
    groups.set(n.exclusiveGroup, list);
  }
  const chips: OrChip[] = [];
  for (const pair of groups.values()) {
    if (pair.length !== 2) continue;
    const [a, b] = pair;
    const midX = (centerXUnits(a) + centerXUnits(b)) / 2;
    chips.push({ leftPct: (midX / VIEW_W) * 100, topPx: centerYUnits(a) });
  }
  return chips;
}

function chipsForActiveBranch(): OrChip[] {
  return exclusiveChips(activeBranch.value);
}

function branchPoints(branch: SkillBranch): { invested: number; total: number; pct: number } {
  const nodes = nodesFor(branch);
  const invested = nodes.reduce((sum, n) => sum + rankOf(n.id), 0);
  const total = nodes.reduce((sum, n) => sum + n.maxPoints, 0);
  return { invested, total, pct: Math.round((invested / Math.max(1, total)) * 100) };
}

function branchTabClass(branch: SkillBranch): string {
  const active = activeBranch.value === branch;
  if (active) {
    return branch === 'vengeance'
      ? 'border-red-500/70 bg-red-950/50 text-red-300'
      : branch === 'resilience'
        ? 'border-green-500/70 bg-green-950/50 text-green-300'
        : 'border-blue-500/70 bg-blue-950/50 text-blue-300';
  }
  return 'border-gray-800 bg-gray-900/60 text-gray-400';
}

function branchBoxClass(branch: SkillBranch): string {
  switch (branch) {
    case 'vengeance': return 'border-red-900/60 bg-red-950/20';
    case 'resilience': return 'border-green-900/60 bg-green-950/20';
    case 'wealth': return 'border-blue-900/60 bg-blue-950/20';
  }
}

function branchTitleClass(branch: SkillBranch): string {
  switch (branch) {
    case 'vengeance': return 'text-red-400';
    case 'resilience': return 'text-green-400';
    case 'wealth': return 'text-blue-400';
  }
}

function branchProgressClass(branch: SkillBranch): string {
  switch (branch) {
    case 'vengeance': return 'bg-red-500';
    case 'resilience': return 'bg-green-500';
    case 'wealth': return 'bg-blue-500';
  }
}

function connectorColor(branch: SkillBranch, active: boolean): string {
  if (!active) return '#374151';
  switch (branch) {
    case 'vengeance': return '#dc2626';
    case 'resilience': return '#16a34a';
    case 'wealth': return '#2563eb';
  }
}

function exclusivePartner(node: SkillNode): SkillNode | null {
  if (!node.exclusiveGroup) return null;
  return SKILL_NODES.find(n => n.exclusiveGroup === node.exclusiveGroup && n.id !== node.id) ?? null;
}

function parentNodes(node: SkillNode): SkillNode[] {
  return node.parents.map(pid => SKILL_NODES.find(n => n.id === pid)).filter((n): n is SkillNode => Boolean(n));
}

const nodeById = new Map(SKILL_NODES.map(n => [n.id, n]));
const selectedNode = computed<SkillNode | null>(() => {
  if (!selectedId.value) return null;
  return nodeById.get(selectedId.value) ?? null;
});

const selectedBranchName = computed(() =>
  selectedNode.value ? SKILL_BRANCHES[selectedNode.value.branch].name : '',
);

const selectedRank = computed(() => (selectedNode.value ? rankOf(selectedNode.value.id) : 0));
const selectedCanInvest = computed(() => (selectedNode.value ? canInvest(selectedNode.value) : false));
const selectedLocked = computed(() => (selectedNode.value ? isLocked(selectedNode.value) : false));
const selectedReady = computed(() => (selectedNode.value ? isReady(selectedNode.value) : true));
const selectedPartner = computed(() => (selectedNode.value ? exclusivePartner(selectedNode.value) : null));
const selectedPartnerRank = computed(() => (selectedPartner.value ? rankOf(selectedPartner.value.id) : 0));
const selectedParents = computed(() => (selectedNode.value ? parentNodes(selectedNode.value) : []));

const levelProgressPct = computed(() => {
  if (!props.xpForNext || props.xpForNext <= 0) return 100;
  return Math.min(100, (props.xpIntoLevel / props.xpForNext) * 100);
});

function handleInvest(nodeId: string) {
  emit('invest', nodeId);
}

function selectNode(nodeId: string) {
  const node = nodeById.get(nodeId);
  if (node) activeBranch.value = node.branch;
  selectedId.value = nodeId;
}

onMounted(() => {
  const firstNode = SKILL_NODES.find(n => n.row === 1) ?? SKILL_NODES[0];
  if (firstNode) {
    selectedId.value = firstNode.id;
    activeBranch.value = firstNode.branch;
  }
});
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm" @click.self="emit('close')">
    <div class="bg-gray-900 border border-cyan-500/50 rounded-2xl shadow-2xl shadow-cyan-950/60 p-4 sm:p-6 w-full max-w-5xl max-h-[92vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex flex-wrap justify-between items-center gap-3 mb-4 border-b border-cyan-800/50 pb-3">
        <div>
          <h2 class="text-xl font-bold tracking-wider text-cyan-400">ZEALOT TALENT TREE</h2>
          <p class="text-xs text-gray-400 mt-0.5">
            Level up by destroying walls & probes — every level grants 1 talent point. Branch out and invest in ranked talents!
          </p>
        </div>
        <div class="flex items-center space-x-3 flex-wrap">
          <div class="bg-amber-950/80 px-3 py-1.5 rounded border border-amber-700/50 text-xs" title="Level 1 point per level-up">
            <span class="text-amber-300 font-bold">LVL {{ level }}</span>
            <span class="text-amber-400/50 mx-1">·</span>
            <span class="text-amber-200/70">{{ xpIntoLevel.toLocaleString() }}/{{ xpForNext.toLocaleString() }} XP</span>
          </div>
          <div class="bg-yellow-900/80 px-3 py-1.5 rounded border border-yellow-600/60 text-xs">
            <span class="text-yellow-300 font-bold">✦ {{ talentPoints }} TALENT {{ talentPoints === 1 ? 'PT' : 'PTS' }}</span>
          </div>
          <button
            @click="emit('respec')"
            :disabled="talentPoints <= 0 && !Object.keys(ranks).some(id => rankOf(id) > 0)"
            class="bg-red-950/70 hover:bg-red-900 text-red-300 font-bold px-3 py-1.5 rounded text-[10px] border border-red-700/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="TIJDELIJKE feature (evaluate before final build): refunds all invested talent points so you can switch exclusive of/of choices. Level & XP stay."
          >
            ↺ RESPEC <span class="opacity-70">(TIJDELIJK)</span>
          </button>
          <button @click="emit('close')"
            class="bg-gray-700 hover:bg-gray-600 text-white font-bold px-3 py-1.5 rounded text-xs transition-colors cursor-pointer">
            ✕ CLOSE
          </button>
        </div>
      </div>

      <!-- Level progress strip -->
      <div class="mb-4">
        <div class="flex justify-between items-center mb-1 text-[10px] text-amber-200/80">
          <span>PROGRESS → LEVEL {{ level + 1 }}</span>
          <span>+1 TALENT PT</span>
        </div>
        <div class="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden border border-amber-800/40">
          <div class="h-full bg-gradient-to-r from-amber-700 to-amber-400 transition-all duration-300" :style="{ width: levelProgressPct + '%' }" />
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4">
        <!-- Active tree (tabs – one full-width tree at a time) -->
        <section>
          <div class="grid grid-cols-3 gap-2 mb-3">
            <button
              v-for="branch in branches"
              :key="branch"
              class="border-2 rounded-lg py-2 text-sm font-bold transition-colors cursor-pointer"
              :class="branchTabClass(branch)"
              @click="activeBranch = branch"
            >
              {{ SKILL_BRANCHES[branch].icon }} {{ SKILL_BRANCHES[branch].name }}
            </button>
          </div>

          <div class="border rounded-2xl p-3 sm:p-4" :class="branchBoxClass(activeBranch)">
            <!-- Branch header -->
            <div class="mb-3">
              <div class="flex justify-between items-center mb-1.5">
                <h3 class="font-bold text-sm tracking-wider" :class="branchTitleClass(activeBranch)">
                  {{ SKILL_BRANCHES[activeBranch].icon }} {{ SKILL_BRANCHES[activeBranch].name.toUpperCase() }}
                  <span class="text-[10px] font-mono text-gray-500">· max {{ MAX_TALENTS_PER_ROW }} per row</span>
                </h3>
                <span class="text-xs font-mono text-gray-400">
                  {{ branchPoints(activeBranch).invested }}/{{ branchPoints(activeBranch).total }} pts
                </span>
              </div>
              <div class="h-1.5 w-full bg-gray-900 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  :class="branchProgressClass(activeBranch)"
                  :style="{ width: branchPoints(activeBranch).pct + '%' }"
                />
              </div>
            </div>

            <!-- Tree canvas (nodes + branch SVG connectors) -->
            <div class="relative" :style="{ height: treeHeight + 'px' }" data-dev="skill-tree-canvas">
              <svg
                class="absolute inset-0 w-full h-full pointer-events-none"
                :viewBox="treeViewBox"
                preserveAspectRatio="none"
              >
                <path
                  v-for="(edge, i) in edgesForActiveBranch()"
                  :key="i"
                  :d="edge.d"
                  :stroke="connectorColor(activeBranch, edge.active)"
                  stroke-width="3"
                  fill="none"
                  stroke-linecap="round"
                  vector-effect="non-scaling-stroke"
                />
              </svg>

              <div
                v-for="node in nodesFor(activeBranch)"
                :key="node.id"
                class="absolute -translate-x-1/2 -translate-y-1/2"
                :style="{ left: leftPct(node) + '%', top: topPx(node) + 'px' }"
              >
                <SkillTreeNode
                  :node="node"
                  :rank="rankOf(node.id)"
                  :can-invest="canInvest(node)"
                  :locked="isLocked(node)"
                  :row-ready="isReady(node)"
                  :selected="selectedId === node.id"
                  @select="selectNode"
                  @invest="handleInvest"
                />
              </div>

              <div
                v-for="(chip, i) in chipsForActiveBranch()"
                :key="'or' + i"
                class="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                :style="{ left: chip.leftPct + '%', top: chip.topPx + 'px' }"
              >
                <span class="text-[9px] font-black tracking-widest text-gray-400 bg-gray-950/95 border border-gray-600 rounded-full px-1.5 py-0.5">
                  OR
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- Detail panel -->
        <aside class="self-start w-full sticky bottom-0 lg:bottom-auto lg:top-0 bg-gray-900 z-10">
          <div v-if="selectedNode" class="border border-cyan-800/60 bg-gray-950/80 rounded-2xl p-4">
            <div class="flex items-start gap-3 border-b border-gray-800 pb-3 mb-3">
              <span class="text-4xl leading-none">{{ selectedNode.icon }}</span>
              <div>
                <div class="text-sm font-bold text-gray-100">{{ selectedNode.name }}</div>
                <div class="text-xs font-mono mt-0.5" :class="branchTitleClass(selectedNode.branch)">
                  {{ selectedBranchName }} · Row {{ selectedNode.row }} of 7 · Rank {{ selectedRank }}/{{ selectedNode.maxPoints }}
                </div>
              </div>
            </div>

            <p class="text-xs text-gray-300 leading-relaxed mb-3">
              {{ selectedNode.description }}
            </p>

            <div class="text-xs mb-3">
              <span class="text-gray-400">Per point: </span>
              <span class="font-bold text-amber-300">{{ selectedNode.perPointLabel }}</span>
            </div>

            <!-- Prerequisites -->
            <div v-if="selectedParents.length > 0" class="text-[10px] text-gray-400 mb-2">
              Requires one of:
              <span v-for="(pn, i) in selectedParents" :key="pn.id" class="inline-block">
                <span class="mx-0.5 px-1.5 py-0.5 rounded border" :class="rankOf(pn.id) > 0 ? 'border-emerald-600/70 bg-emerald-950/40 text-emerald-300' : 'border-gray-600 bg-gray-900 text-gray-500'">
                  {{ pn.icon }} {{ pn.name }} {{ rankOf(pn.id) > 0 ? '✓' : '' }}
                </span>
                <span v-if="i < selectedParents.length - 1">/</span>
              </span>
            </div>

            <!-- Exclusive partner info -->
            <div v-if="selectedPartner && selectedPartnerRank > 0" class="text-[10px] text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-2.5 py-2 mb-3">
              🔒 Exclusive: <span class="font-bold">{{ selectedPartner.name }}</span> is already invested ({{ selectedPartnerRank }}/{{ selectedPartner.maxPoints }}). You cannot invest in this talent too.
            </div>

            <div v-if="selectedRank >= selectedNode.maxPoints" class="text-xs font-bold text-emerald-400">
              ✓ Max rank reached ({{ selectedNode.maxPoints }}/{{ selectedNode.maxPoints }})
            </div>
            <div v-else-if="selectedCanInvest" class="mt-1">
              <div class="text-[10px] text-amber-300/90 mb-1.5">You have enough talent points!</div>
              <button
                class="w-full text-xs font-black text-black bg-yellow-400 hover:bg-yellow-300 border border-yellow-200 rounded-lg px-3 py-2 transition-colors cursor-pointer"
                @click="handleInvest(selectedNode.id)"
              >
                INVEST 1 PT ({{ selectedRank + 1 }}/{{ selectedNode.maxPoints }})
              </button>
            </div>
            <div v-else-if="selectedLocked" class="text-xs text-red-400">
              Locked by an exclusive of/of choice — switch sides with RESPEC (TIJDELIJK).
            </div>
            <div v-else-if="!selectedReady" class="text-xs text-gray-500">
              Invest in one of its prerequisite talents first.
            </div>
            <div v-else class="text-xs text-gray-500">
              Needs <span class="font-bold text-amber-300">1 talent point</span> to invest. Earn XP to level up!
            </div>
          </div>

          <div v-else class="border border-gray-800 bg-gray-950 rounded-2xl p-4 text-center text-xs text-gray-500">
            Click a talent to see its details.
          </div>
        </aside>
      </div>

      <!-- Footer hint -->
      <div class="mt-4 text-[10px] text-gray-500 text-center">
        Every node needs a parent talent to unlock · golden glow = can invest · OR = exclusive choice · RESPEC (TIJDELIJK) = refund all points
      </div>
    </div>
  </div>
</template>