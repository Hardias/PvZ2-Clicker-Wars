# Tasks: Probes vs Zealot 2 Clicker Game

## 1. TypeScript Interfaces & Types
- [x] Create `resources/js/types/Item.ts` for inventory items (6 slots, categories: Blades/Damage, Gloves/AttackSpeed, Amulet/HP, Armor/Defense, Trinket/HPRegen, zero consumables)
- [x] Create `resources/js/types/Zealot.ts` for Zealot stats (HP, attack power, attack speed, defense, HP regen, level)
- [x] Create `resources/js/types/ProbeBase.ts` for enemy probe bases and defenses (Walls: Wall 1-5 → Ultra 1-5 → Mega 1-5 → Power 1-2 → Final Wall; Turrets Lv 1-13)
- [x] Create `resources/js/types/Shop.ts` for shop items, gear, upgrades, and currency (Minerals/Bounty)

## 2. Composables & Game State Logic
- [x] Implement `resources/js/composables/useZealot.ts` (stats management, health, leveling, damage calculation)
- [x] Implement `resources/js/composables/useInventory.ts` (6 fixed item slots corresponding to equipment categories, equip/unequip)
- [x] Implement `resources/js/composables/useCombat.ts` (clicking attacks against wall/turrets, auto-attack tick, enemy defense progression, rewards)
- [x] Implement `resources/js/composables/useSaveSystem.ts` (localStorage persistence for game state, inventory, and progress)

## 3. UI Components (Vue 3 + Composition API + Scoped CSS)
- [x] Create `resources/js/components/ZealotStatsComponent.vue` (display HP, Attack, Speed, Defense, HP Regen, Level)
- [x] Create `resources/js/components/InventoryGrid.vue` (render exactly 6 item slots with category labels and equipment management)
- [x] Create `resources/js/components/BattleArea.vue` (Probe base visual showing current wall tier/level and turrets, click-to-attack interaction)
- [x] Create `resources/js/components/ShopModal.vue` (Shop interface accessible only at base/shop to purchase gear and upgrades)
- [x] Create `resources/js/components/GameHeader.vue` (switching between Battle Area and Shop Base, resource counters)

## 4. Integration & Polish
- [x] Integrate all composables and components into main view with centralized game loop
- [x] Add Protoss sci-fi aesthetic (Tailwind CSS + Scoped CSS, dark mode, glowing blue/gold accents)
- [x] Verify save/load system with localStorage
