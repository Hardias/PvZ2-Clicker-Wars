import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BattleArea from './BattleArea.vue';
import { probeBaseMock } from '../utils/testMocks';
import { big } from '../utils/bigNumber';

const defaultProps = {
  probeBase: probeBaseMock(),
  attackPower: big(150),
  zealotHp: big(50),
  zealotMaxHp: big(100),
  comboCount: 5,
  comboMax: 50,
  comboMultiplier: 1.2,
};

describe('BattleArea', () => {
  it('renders the live Zealot HP bar with its percentage', () => {
    const wrapper = mount(BattleArea, { props: defaultProps });
    const text = wrapper.text();
    expect(text).toContain('ZEALOT HP');
    expect(text).toContain('50 / 100');
    expect(text).toContain('(50%)');
  });

  it('renders the wall name, level and current HP', () => {
    const wrapper = mount(BattleArea, { props: defaultProps });
    const text = wrapper.text();
    expect(text).toContain('D- Rank Wall (Lv. 1)');
    expect(text).toContain('500 / 1k');
  });

  it('shows the attack-power hint on the clickable arena', () => {
    const wrapper = mount(BattleArea, { props: defaultProps });
    expect(wrapper.text()).toContain('(-150 DMG)');
  });

  it('shows the no-turrets placeholder when the probe has no turrets', () => {
    const wrapper = mount(BattleArea, { props: defaultProps });
    expect(wrapper.text()).toContain('No Turrets');
  });

  it('emits attack when the arena is clicked', () => {
    const wrapper = mount(BattleArea, { props: defaultProps });
    const arena = wrapper.find('.data-clickable');
    expect(arena.exists()).toBe(true);
    arena.trigger('click');
    expect(wrapper.emitted('attack')).toHaveLength(1);
  });

  it('shows the immobilized banner when the zealot is immobilized', () => {
    const wrapper = mount(BattleArea, { props: { ...defaultProps, isImmobilized: true } });
    expect(wrapper.text()).toContain('IMMOBILIZED');
  });
});