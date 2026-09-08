import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import InventoryGrid from './InventoryGrid.vue';
import { InventorySlot, ItemCategory } from '../types/Item';
import { big } from '../utils/bigNumber';

const CATEGORIES: ItemCategory[] = ['blades', 'gloves', 'amulet', 'armor', 'trinket', 'final'];

const filledSlot: InventorySlot = {
  slotIndex: 0,
  category: 'blades',
  item: {
    id: 'blade1',
    name: 'Psi Blade',
    category: 'blades',
    rarity: 'common',
    stats: { damage: big(150) },
    cost: big(100),
    currency: 'minerals',
    description: 'A sharpened psi-blade.',
  },
};

function makeSlots(filled: boolean): InventorySlot[] {
  return CATEGORIES.map((category, index) =>
    filled && index === 0 ? filledSlot : { slotIndex: index, category, item: null },
  );
}

describe('InventoryGrid', () => {
  it('renders the equipment header', () => {
    const wrapper = mount(InventoryGrid, { props: { slots: makeSlots(false) } });
    expect(wrapper.text()).toContain('EQUIPMENT (6 SLOTS)');
  });

  it('renders 6 slot cells', () => {
    const wrapper = mount(InventoryGrid, { props: { slots: makeSlots(false) } });
    const numbers = wrapper.findAll('.absolute.top-1.left-2');
    expect(numbers).toHaveLength(6);
  });

  it('shows item name and stats for a filled slot', () => {
    const wrapper = mount(InventoryGrid, { props: { slots: makeSlots(true) } });
    const text = wrapper.text();
    expect(text).toContain('Psi Blade');
    expect(text).toContain('+150 DMG');
  });

  it('does not render remove buttons for empty slots', () => {
    const wrapper = mount(InventoryGrid, { props: { slots: makeSlots(false) } });
    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('emits unequip with the slot index from the remove button', () => {
    const wrapper = mount(InventoryGrid, { props: { slots: makeSlots(true) } });
    const buttons = wrapper.findAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0].trigger('click');
    expect(wrapper.emitted('unequip')).toEqual([[0]]);
  });
});