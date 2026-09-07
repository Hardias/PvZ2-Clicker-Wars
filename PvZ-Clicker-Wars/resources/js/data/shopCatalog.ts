import { Item } from '../types/Item';

/** Full catalog of Zealot Shop items with correct Mineral/Vespene costs. */
export const AVAILABLE_SHOP_ITEMS: Item[] = [
  // --- BLADES ---
  { id: 'b_copper', name: 'Copper blade', category: 'blades', rarity: 'common', stats: { damage: 2 }, cost: 100, currency: 'minerals', description: '100M | +2 Damage' },
  { id: 'b_iron', name: 'Iron blade', category: 'blades', rarity: 'common', stats: { damage: 4 }, cost: 200, currency: 'minerals', description: '200M | +4 Damage' },
  { id: 'b_steel', name: 'Steel blade', category: 'blades', rarity: 'common', stats: { damage: 8 }, cost: 400, currency: 'minerals', description: '400M | +8 Damage' },
  { id: 'b_silver', name: 'Silver blade', category: 'blades', rarity: 'rare', stats: { damage: 16 }, cost: 800, currency: 'minerals', description: '800M | +16 Damage' },
  { id: 'b_golden', name: 'Golden blade', category: 'blades', rarity: 'rare', stats: { damage: 32 }, cost: 1600, currency: 'minerals', description: '1600M | +32 Damage' },
  { id: 'b_platinum', name: 'Platinum blade', category: 'blades', rarity: 'epic', stats: { damage: 64 }, cost: 3200, currency: 'minerals', description: '3200M | +64 Damage' },
  { id: 'b_mithril', name: 'Mithril blade', category: 'blades', rarity: 'epic', stats: { damage: 128 }, cost: 6400, currency: 'minerals', description: '6400M | +128 Damage' },
  { id: 'b_diamond', name: 'Diamond blade', category: 'blades', rarity: 'legendary', stats: { damage: 256 }, cost: 12800, currency: 'minerals', description: '12800M | +256 Damage' },
  { id: 'b_energizer', name: 'Energizer blade', category: 'blades', rarity: 'legendary', stats: { damage: 1280 }, cost: 1, currency: 'vespene', description: '1V | +1280 Damage (Max Glove Effect Built-in)' },
  { id: 'b_pulverizer', name: 'Pulverizer blade', category: 'blades', rarity: 'legendary', stats: { damage: 2560 }, cost: 2, currency: 'vespene', description: '2V | +2560 Damage (Max Glove Effect Built-in)' },
  { id: 'b_atomizer', name: 'Atomizer blade', category: 'blades', rarity: 'legendary', stats: { damage: 10240 }, cost: 8, currency: 'vespene', description: '8V | +10240 Damage (Max Glove Effect Built-in)' },
  { id: 'b_ultimate', name: 'Ultimate blade', category: 'blades', rarity: 'legendary', stats: { damage: 40960 }, cost: 32, currency: 'vespene', description: '32V | +40960 Damage (Max Glove Effect Built-in)' },
  { id: 'b_plutonium', name: 'Plutonium blade', category: 'blades', rarity: 'legendary', stats: { damage: 61440 }, cost: 160, currency: 'vespene', description: '160V | +61440 Damage (Max Glove Effect Built-in)' },
  { id: 'b_radiant', name: 'Radiant blade', category: 'blades', rarity: 'legendary', stats: { damage: 81920 }, cost: 512, currency: 'vespene', description: '512V | +81920 Damage (Max Glove Effect Built-in)' },

  // --- GLOVES (Attack Speed) ---
  { id: 'g_cloth', name: 'Cloth gloves', category: 'gloves', rarity: 'common', stats: { attackSpeed: 0.2 }, cost: 100, currency: 'minerals', description: '100M | +20% Attack Speed' },
  { id: 'g_leather', name: 'Leather gloves', category: 'gloves', rarity: 'common', stats: { attackSpeed: 0.4 }, cost: 200, currency: 'minerals', description: '200M | +40% Attack Speed' },
  { id: 'g_hide', name: 'Reinforced Hide gloves', category: 'gloves', rarity: 'common', stats: { attackSpeed: 0.8 }, cost: 400, currency: 'minerals', description: '400M | +80% Attack Speed' },
  { id: 'g_scale', name: 'Scale gloves', category: 'gloves', rarity: 'rare', stats: { attackSpeed: 1.0 }, cost: 800, currency: 'minerals', description: '800M | +100% Attack Speed' },
  { id: 'g_bone', name: 'Bone gloves', category: 'gloves', rarity: 'rare', stats: { attackSpeed: 1.5 }, cost: 1600, currency: 'minerals', description: '1600M | +150% Attack Speed' },
  { id: 'g_electronic', name: 'Electronic gloves', category: 'gloves', rarity: 'epic', stats: { attackSpeed: 2.0 }, cost: 3200, currency: 'minerals', description: '3200M | +200% Attack Speed' },
  { id: 'g_mega', name: 'Mega gloves', category: 'gloves', rarity: 'epic', stats: { attackSpeed: 3.0 }, cost: 6400, currency: 'minerals', description: '6400M | +300% Attack Speed' },
  { id: 'g_super', name: 'Super gloves', category: 'gloves', rarity: 'legendary', stats: { attackSpeed: 4.0 }, cost: 12800, currency: 'minerals', description: '12800M | +400% Attack Speed' },

  // --- ARMOR (Damage Reduction) ---
  { id: 'ar_wood', name: 'Wooden armor', category: 'armor', rarity: 'common', stats: { defenseReduction: 0.09 }, cost: 100, currency: 'minerals', description: '100M | 9% Damage Reduction' },
  { id: 'ar_rwood', name: 'Reinforced Wooden armor', category: 'armor', rarity: 'common', stats: { defenseReduction: 0.18 }, cost: 200, currency: 'minerals', description: '200M | 18% Damage Reduction' },
  { id: 'ar_iron', name: 'Iron armor', category: 'armor', rarity: 'common', stats: { defenseReduction: 0.27 }, cost: 400, currency: 'minerals', description: '400M | 27% Damage Reduction' },
  { id: 'ar_steel', name: 'Steel armor', category: 'armor', rarity: 'rare', stats: { defenseReduction: 0.36 }, cost: 800, currency: 'minerals', description: '800M | 36% Damage Reduction' },
  { id: 'ar_silver', name: 'Silver armor', category: 'armor', rarity: 'rare', stats: { defenseReduction: 0.45 }, cost: 1600, currency: 'minerals', description: '1600M | 45% Damage Reduction' },
  { id: 'ar_gold', name: 'Gold armor', category: 'armor', rarity: 'epic', stats: { defenseReduction: 0.54 }, cost: 3200, currency: 'minerals', description: '3200M | 54% Damage Reduction' },
  { id: 'ar_plat', name: 'Platinum armor', category: 'armor', rarity: 'epic', stats: { defenseReduction: 0.63 }, cost: 6400, currency: 'minerals', description: '6400M | 63% Damage Reduction' },
  { id: 'ar_titanium', name: 'Titanium armor', category: 'armor', rarity: 'legendary', stats: { defenseReduction: 0.72 }, cost: 12800, currency: 'minerals', description: '12800M | 72% Damage Reduction' },
  { id: 'ar_chromite', name: 'Chromite armor', category: 'armor', rarity: 'legendary', stats: { defenseReduction: 0.92 }, cost: 1, currency: 'vespene', description: '1V | 92% Damage Reduction' },
  { id: 'ar_pyrite', name: 'Pyrite armor', category: 'armor', rarity: 'legendary', stats: { defenseReduction: 0.96 }, cost: 2, currency: 'vespene', description: '2V | 96% Damage Reduction' },
  { id: 'ar_tungsten', name: 'Tungsten armor', category: 'armor', rarity: 'legendary', stats: { defenseReduction: 0.98 }, cost: 8, currency: 'vespene', description: '8V | 98% Damage Reduction' },
  { id: 'ar_nano', name: 'Nanocrystalline Diamond armor', category: 'armor', rarity: 'legendary', stats: { defenseReduction: 0.99 }, cost: 32, currency: 'vespene', description: '32V | 99% Damage Reduction' },
  { id: 'ar_uranium', name: 'Uranium armor', category: 'armor', rarity: 'legendary', stats: { defenseReduction: 0.995 }, cost: 160, currency: 'vespene', description: '160V | 99.5% Damage Reduction' },
  { id: 'ar_rubidium', name: 'Rubidium armor', category: 'armor', rarity: 'legendary', stats: { defenseReduction: 0.9975 }, cost: 512, currency: 'vespene', description: '512V | 99.75% Damage Reduction' },

  // --- AMULETS (Health) ---
  { id: 'am_zircon', name: 'Zircon Amulet', category: 'amulet', rarity: 'common', stats: { hp: 250 }, cost: 100, currency: 'minerals', description: '100M | +250 Health' },
  { id: 'am_amethyst', name: 'Amethyst Amulet', category: 'amulet', rarity: 'common', stats: { hp: 500 }, cost: 200, currency: 'minerals', description: '200M | +500 Health' },
  { id: 'am_topaz', name: 'Topaz Amulet', category: 'amulet', rarity: 'common', stats: { hp: 1000 }, cost: 400, currency: 'minerals', description: '400M | +1000 Health' },
  { id: 'am_spinel', name: 'Spinel Amulet', category: 'amulet', rarity: 'rare', stats: { hp: 2000 }, cost: 800, currency: 'minerals', description: '800M | +2000 Health' },
  { id: 'am_sapphire', name: 'Sapphire Amulet', category: 'amulet', rarity: 'rare', stats: { hp: 4000 }, cost: 1600, currency: 'minerals', description: '1600M | +4000 Health' },
  { id: 'am_emerald', name: 'Emerald Amulet', category: 'amulet', rarity: 'epic', stats: { hp: 8000 }, cost: 3200, currency: 'minerals', description: '3200M | +8000 Health' },
  { id: 'am_ruby', name: 'Ruby Amulet', category: 'amulet', rarity: 'epic', stats: { hp: 16000 }, cost: 6400, currency: 'minerals', description: '6400M | +16000 Health' },
  { id: 'am_corundum', name: 'Corundum Amulet', category: 'amulet', rarity: 'legendary', stats: { hp: 32000 }, cost: 12800, currency: 'minerals', description: '12800M | +32000 Health' },
  { id: 'am_titanium', name: 'Titanium Amulet', category: 'amulet', rarity: 'legendary', stats: { hp: 160000 }, cost: 1, currency: 'vespene', description: '1V | +160000 Health' },
  { id: 'am_obsidian', name: 'Obsidian Amulet', category: 'amulet', rarity: 'legendary', stats: { hp: 320000 }, cost: 2, currency: 'vespene', description: '2V | +320000 Health' },
  { id: 'am_diamond', name: 'Diamond Amulet', category: 'amulet', rarity: 'legendary', stats: { hp: 471000 }, cost: 8, currency: 'vespene', description: '8V | +471000 Health' },

  // --- POTIONS / TRINKETS (Health Regeneration) ---
  { id: 'p_minor', name: 'Minor regeneration potion', category: 'trinket', rarity: 'common', stats: { hpRegen: 6 }, cost: 100, currency: 'minerals', description: '100M | +6/s HP Regen' },
  { id: 'p_lesser', name: 'Lesser regeneration potion', category: 'trinket', rarity: 'common', stats: { hpRegen: 12 }, cost: 200, currency: 'minerals', description: '200M | +12/s HP Regen' },
  { id: 'p_common', name: 'Common regeneration potion', category: 'trinket', rarity: 'common', stats: { hpRegen: 24 }, cost: 400, currency: 'minerals', description: '400M | +24/s HP Regen' },
  { id: 'p_greater', name: 'Greater regeneration potion', category: 'trinket', rarity: 'rare', stats: { hpRegen: 48 }, cost: 800, currency: 'minerals', description: '800M | +48/s HP Regen' },
  { id: 'p_superior', name: 'Superior regeneration potion', category: 'trinket', rarity: 'rare', stats: { hpRegen: 96 }, cost: 1600, currency: 'minerals', description: '1600M | +96/s HP Regen' },
  { id: 'p_major', name: 'Major regeneration potion', category: 'trinket', rarity: 'epic', stats: { hpRegen: 192 }, cost: 3200, currency: 'minerals', description: '3200M | +192/s HP Regen' },
  { id: 'p_ultra', name: 'Ultra regeneration potion', category: 'trinket', rarity: 'epic', stats: { hpRegen: 384 }, cost: 6400, currency: 'minerals', description: '6400M | +384/s HP Regen' },
  { id: 'p_extreme', name: 'Extreme regeneration potion', category: 'trinket', rarity: 'legendary', stats: { hpRegen: 768 }, cost: 12800, currency: 'minerals', description: '12800M | +768/s HP Regen' },
  { id: 'p_mega', name: 'Mega regeneration potion', category: 'trinket', rarity: 'legendary', stats: { hpRegen: 3840 }, cost: 1, currency: 'vespene', description: '1V | +3840/s HP Regen' },
  { id: 'p_eternal', name: 'Eternal regeneration potion', category: 'trinket', rarity: 'legendary', stats: { hpRegen: 7680 }, cost: 2, currency: 'vespene', description: '2V | +7680/s HP Regen' },
  { id: 'p_ultimate', name: 'Ultimate regeneration potion', category: 'trinket', rarity: 'legendary', stats: { hpRegen: 20480 }, cost: 8, currency: 'vespene', description: '8V | +20480/s HP Regen' },

  // --- FINAL ITEMS ---
  { id: 'b_final', name: 'Final blade', category: 'final', rarity: 'legendary', stats: { damage: 819200, attackSpeed: 40.0 }, cost: 1596, currency: 'vespene', description: '1596V | +819,200 Damage & +4000% Attack Speed (Final Tier)' },
  { id: 'p_final', name: 'Final regeneration', category: 'final', rarity: 'legendary', stats: { hpRegen: 2048000 }, cost: 512, currency: 'vespene', description: '512V | +2,048,000/s HP Regen (Final Tier)' },
];