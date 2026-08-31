# Agent Instructions & Project Guidelines: Probes vs Zealot 2 Clicker Game

## 🎮 Project Goal
Build an addictive clicker / RPG-lite game inspired by the legendary StarCraft 2 Arcade game **Probes vs Zealot 2 (Pvมั่นZ2)**.
- **Player Role**: You play as the **Zealot**, assaulting enemy Probe bases, destroying defenses, and farming resources/bounty.
- **Enemies**: **Probes** that construct bases, Photon Cannons, Shield Batteries, and Pylons to defend themselves.
- **Zealot Mechanics**: 
  - Active combat/clicking against Probe bases and defenses.
  - **6 Item Slots**: Inventory system with specific categories (Blades/Damage, Gloves/AttackSpeed, Amulet/HP, Armor/Defense, Trinket/HPRegen). No consumables.
  - **Shop System**: Upgrades and items can *only* be purchased when visiting the shop area/base.
- **Probe Defenses**:
  - **Walls**: Progression order: Wall (Lv 1-5) → Ultra Wall (Lv 1-5) → Mega Wall (Lv 1-5) → Power Wall (Lv 1-2) → Final Wall (max).
  - **Turrets**: Levels 1 to 13 (no normal SC2 buildings).

---

## 🛠️ Tech Stack & Environment
- **Framework**: Vue 3 (Composition API with `<script setup lang="ts">`)
- **Language**: TypeScript (Strict type safety, zero use of `any`)
- **Bundler**: Vite
- **Styling**: Tailwind CSS & Scoped CSS
- **Persistence**: `localStorage` (Save/Load game state, inventory, progress)

---

## 🏛️ Architecture & Code Standards
1. **Single File Components (.vue)**: Modular, clean components.
2. **Reactivity**:
   - Use `ref()` for primitive values (e.g., `minerals`, `gold`, `zealotHp`, `currentWave`).
   - Use `reactive()` for complex state objects (e.g., `zealotInventory` [6 slots], `probeBase`, `shopItems`).
3. **Type Safety**:
   - Dedicated `src/types/` directory for TypeScript interfaces (`Item.ts`, `Zealot.ts`, `ProbeBase.ts`, `Upgrade.ts`).
   - No `any` types allowed.
4. **Game Loop & State**:
   - Centralized game loop handling attack ticks, enemy base health regeneration/shield mechanics, and idle progress.
   - Automatic persistence to `localStorage`.

---

## 📂 Project Structure Plan
- `src/types/` - TypeScript definitions (Inventory items, Zealot stats, Probe defenses)
- `src/composables/` - Game logic hooks (`useZealot`, `useInventory`, `useCombat`, `useSaveSystem`)
- `src/components/` - UI Components 
  - `ZealotStats.vue` (HP, Attack, Speed, Energy)
  - `InventoryGrid.vue` (The 6 item slots)
  - `BattleArea.vue` (Clicking/attacking Probe bases & Photon Cannons)
  - `ShopModal.vue` (Shop interface accessible only at base/shop)
- `src/App.vue` - Main layout and container

---

## 🚀 Key Rules for Agents
1. **No Options API**: Strictly use Vue 3 Composition API with `<script setup lang="ts">`.
2. **Accurate Lore & Mechanics**: Emphasize the Zealot perspective, 6 inventory slots, and shop-exclusive purchasing.
3. **Protoss Aesthetic**: Sci-fi theme with dark mode, glowing blue/gold accents, and clean UI.
4. **Error-Free Builds**: Ensure strict type checking and clean builds.
