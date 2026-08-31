# Tasks: Probes vs Zealot 2 Clicker Game

## 1. TypeScript Interfaces & Types
- [ ] Create `resources/js/types/Item.ts` for inventory items (6 slots, categories: Blades/Damage, Gloves/AttackSpeed, Amulet/HP, Armor/Defense, Trinket/HPRegen, zero consumables)
- [ ] Create `resources/js/types/Zealot.ts` for Zealot stats (HP, attack power, attack speed, defense, HP regen, level)
- [ ] Create `resources/js/types/ProbeBase.ts` for enemy probe bases and defenses (Walls: Wall 1-5 → Ultra 1-5 → Mega 1-5 → Power 1-2 → Final Wall; Turrets Lv 1-13)
- [ ] Create `resources/js/types/Shop.ts` for shop items, gear, upgrades, and currency (Minerals/Bounty)

## 2. Composables & Game State Logic
- [ ] Implement `resources/js/composables/useZealot.ts` (stats management, health, leveling, damage calculation)
- [ ] Implement `resources/js/composables/useInventory.ts` (6 fixed item slots corresponding to equipment categories, equip/unequip)
- [ ] Implement `resources/js/composables/useCombat.ts` (clicking attacks against wall/turrets, auto-attack tick, enemy defense progression, rewards)
- [ ] Implement `resources/js/composables/useSaveSystem.ts` (localStorage persistence for game state, inventory, and progress)

## 3. UI Components (Vue 3 + Composition API + Scoped CSS)
- [ ] Create `resources/js/components/ZealotStats.vue` (display HP, Attack, Speed, Defense, HP Regen, Level)
- [ ] Create `resources/js/components/InventoryGrid.vue` (render exactly 6 item slots with category labels and equipment management)
- [ ] Create `resources/js/components/BattleArea.vue` (Probe base visual showing current wall tier/level and turrets, click-to-attack interaction)
- [ ] Create `resources/js/components/ShopModal.vue` (Shop interface accessible only at base/shop to purchase gear and upgrades)
- [ ] Create `resources/js/components/GameHeader.vue` (switching between Battle Area and Shop Base, resource counters)

## 4. Integration & Polish
- [ ] Integrate all composables and components into main view with centralized game loop
- [ ] Add Protoss sci-fi aesthetic (Tailwind CSS + Scoped CSS, dark mode, glowing blue/gold accents)
- [ ] Verify save/load system with localStorage
- [ ] Run build verification (`npm run build`)
