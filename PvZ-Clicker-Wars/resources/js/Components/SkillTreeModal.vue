<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { SkillBranch, SkillNode, SKILL_NODES, SKILL_BRANCHES } from '../types/SkillTree';
import SkillTreeNode from './SkillTreeNode.vue';

interface Props {
  unlockedNodes: string[];
  availableXp: number;
  totalXp: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'unlock', nodeId: string): void;
  (e: 'close'): void;
}>();

const branches = computed<SkillBranch[]>(() => ['vengeance', 'resilience', 'wealth']);

const activeBranch = ref<SkillBranch>('vengeance');
const selectedId = ref<string | null>(null);

function branchNodes(branch: SkillBranch): SkillNode[] {
  return SKILL_NODES.filter(n => n.branch === branch).sort((a, b) => a.row - b.row);
}

function isUnlocked(nodeId: string): boolean {
  return props.unlockedNodes.includes(nodeId);
}

function isNextInBranch(branch: SkillBranch, node: SkillNode): boolean {
  const nodes = branchNodes(branch);
  const idx = nodes.findIndex(n => n.id === node.id);
  return idx !== -1 && !isUnlocked(node.id) && (idx === 0 || isUnlocked(nodes[idx - 1].id));
}

function canUnlockNode(node: SkillNode): boolean {
  if (isUnlocked(node.id)) return false;
  if (node.requiresPrevious) {
    const nodes = branchNodes(node.branch);
    const idx = nodes.findIndex(n => n.id === node.id);
    if (idx > 0 && !isUnlocked(nodes[idx - 1].id)) return false;
  }
  return props.availableXp >= node.cost;
}

function connectorActive(branch: SkillBranch, node: SkillNode): boolean {
  return isUnlocked(node.id);
}

function branchProgress(branch: SkillBranch): { unlocked: number; total: number; pct: number } {
  const nodes = branchNodes(branch);
  const unlocked = nodes.filter(n => isUnlocked(n.id)).length;
  return { unlocked, total: nodes.length, pct: Math.round((unlocked / nodes.length) * 100) };
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

function progressBarClass(branch: SkillBranch): string {
  switch (branch) {
    case 'vengeance': return 'bg-red-500';
    case 'resilience': return 'bg-green-500';
    case 'wealth': return 'bg-blue-500';
  }
}

function connectorClass(branch: SkillBranch): string {
  switch (branch) {
    case 'vengeance': return 'bg-red-600';
    case 'resilience': return 'bg-green-600';
    case 'wealth': return 'bg-blue-600';
  }
}

const selectedNode = computed<SkillNode | null>(() => {
  if (!selectedId.value) return null;
  return SKILL_NODES.find(n => n.id === selectedId.value) ?? null;
});

const selectedBranchName = computed(() =>
  selectedNode.value ? SKILL_BRANCHES[selectedNode.value.branch].name : '',
);

function handleUnlock(nodeId: string) {
  emit('unlock', nodeId);
}

function selectNode(nodeId: string) {
  selectedId.value = nodeId;
}

onMounted(() => {
  const firstLocked = branches.value
    .map(branch => branchNodes(branch).find(n => !isUnlocked(n.id)))
    .find(n => n !== undefined) ?? null;
  if (firstLocked) {
    selectedId.value = firstLocked.id;
    activeBranch.value = firstLocked.branch;
  }
});
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm" @click.self="emit('close')">
    <div class="bg-gray-900 border border-cyan-500/50 rounded-2xl shadow-2xl shadow-cyan-950/60 p-4 sm:p-6 w-full max-w-5xl max-h-[92vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex flex-wrap justify-between items-center gap-3 mb-4 border-b border-cyan-800/50 pb-3">
        <div>
          <h2 class="text-xl font-bold tracking-wider text-cyan-400">ZEALOT SKILL TREE</h2>
          <p class="text-xs text-gray-400 mt-0.5">
            Spend Zealot XP on permanent upgrades — earn XP by destroying walls & probes!
          </p>
        </div>
        <div class="flex items-center space-x-3">
          <div class="bg-amber-950/80 px-3 py-1.5 rounded border border-amber-700/50 text-xs">
            <span class="text-amber-300 font-bold">Available XP: {{ availableXp.toLocaleString() }}</span>
            <span class="text-amber-400/50 mx-1">·</span>
            <span class="text-amber-200/70">Total {{ totalXp.toLocaleString() }}</span>
          </div>
          <button @click="emit('close')"
            class="bg-gray-700 hover:bg-gray-600 text-white font-bold px-3 py-1.5 rounded text-xs transition-colors cursor-pointer">
            ✕ CLOSE
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4">
        <!-- Trees -->
        <section>
          <!-- Mobile tabs -->
          <div class="grid grid-cols-3 gap-2 mb-3 lg:hidden">
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

          <!-- Branch columns -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div
              v-for="branch in branches"
              :key="branch"
              class="border rounded-2xl p-3 transition-opacity"
              :class="[branchBoxClass(branch), activeBranch === branch ? '' : 'hidden', 'md:block']"
            >
              <!-- Branch header -->
              <div class="mb-3">
                <div class="flex justify-between items-center mb-1.5">
                  <h3 class="font-bold text-sm tracking-wider" :class="branchTitleClass(branch)">
                    {{ SKILL_BRANCHES[branch].icon }} {{ SKILL_BRANCHES[branch].name.toUpperCase() }}
                  </h3>
                  <span class="text-xs font-mono text-gray-400">
                    {{ branchProgress(branch).unlocked }}/{{ branchProgress(branch).total }}
                  </span>
                </div>
                <div class="h-1.5 w-full bg-gray-900 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-300"
                    :class="progressBarClass(branch)"
                    :style="{ width: branchProgress(branch).pct + '%' }"
                  />
                </div>
              </div>

              <!-- Nodes with connectors -->
              <div v-for="(node, idx) in branchNodes(branch)" :key="node.id">
                <SkillTreeNode
                  :node="node"
                  :unlocked="isUnlocked(node.id)"
                  :can-unlock="canUnlockNode(node)"
                  :is-next-in-branch="isNextInBranch(branch, node)"
                  :selected="selectedId === node.id"
                  @select="selectNode"
                  @unlock="handleUnlock"
                />
                <div
                  v-if="idx < branchNodes(branch).length - 1"
                  class="flex justify-center py-0.5"
                >
                  <div
                    class="w-1 h-6 rounded-full transition-colors duration-300"
                    :class="connectorActive(branch, node) ? connectorClass(branch) : 'bg-gray-800'"
                  />
                </div>
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
                  {{ selectedBranchName }} · Row {{ selectedNode.row }} of 7
                </div>
              </div>
            </div>

            <p class="text-xs text-gray-300 leading-relaxed mb-3">
              {{ selectedNode.description }}
            </p>

            <div v-if="isUnlocked(selectedNode.id)" class="text-xs font-bold text-emerald-400">
              ✓ Unlocked
            </div>
            <div v-else-if="canUnlockNode(selectedNode)" class="mt-1">
              <div class="text-[10px] text-amber-300/90 mb-1.5">You have enough XP!</div>
              <button
                class="w-full text-xs font-black text-black bg-yellow-400 hover:bg-yellow-300 border border-yellow-200 rounded-lg px-3 py-2 transition-colors cursor-pointer"
                @click="handleUnlock(selectedNode.id)"
              >
                UNLOCK ({{ selectedNode.cost }} XP)
              </button>
            </div>
            <div v-else-if="isNextInBranch(selectedNode.branch, selectedNode)"
              class="text-xs text-amber-300/90">
              Needs <span class="font-bold">{{ (selectedNode.cost - availableXp) > 0 ? (selectedNode.cost - availableXp).toLocaleString() : 0 }}</span> more XP to unlock.
            </div>
            <div v-else class="text-xs text-gray-500">
              Unlock the previous node in this branch first.
            </div>
          </div>

          <div v-else class="border border-gray-800 bg-gray-950 rounded-2xl p-4 text-center text-xs text-gray-500">
            Click a skill to see its details.
          </div>
        </aside>
      </div>

      <!-- Footer hint -->
      <div class="mt-4 text-[10px] text-gray-500 text-center">
        Unlock in order per branch · golden glow = ready to buy · {{ totalXp.toLocaleString() }} total XP earned
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>