import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ZealotStatsComponent from './ZealotStatsComponent.vue';
import { zealotStatsMock } from '../utils/testMocks';
import { big } from '../utils/bigNumber';
import { DEFAULT_SKILL_BONUSES } from '../types/SkillTree';

const defaultProps = {
  zealot: zealotStatsMock(),
  attackPower: big(150),
  attackSpeed: 2.5,
  currentDps: big(375),
  defense: 0.5,
  hpRegen: big(25),
  equipmentStats: {
    damage: big(50),
    hp: big(200),
    totalDefenseReduction: 0.1,
  },
};

describe('ZealotStatsComponent', () => {
  it('renders the title as ZEALOT', () => {
    const wrapper = mount(ZealotStatsComponent, { props: defaultProps });
    expect(wrapper.text()).toContain('ZEALOT');
    expect(wrapper.text()).not.toContain('WARRIOR');
  });

  it('no longer renders an HP bar block', () => {
    const wrapper = mount(ZealotStatsComponent, { props: defaultProps });
    expect(wrapper.text()).not.toContain('HP');
  });

  it('shows the core stats from its props', () => {
    const wrapper = mount(ZealotStatsComponent, { props: defaultProps });
    const text = wrapper.text();
    expect(text).toContain('150');
    expect(text).toContain('(+50)');
    expect(text).toContain('2.5/s');
    expect(text).toContain('10%');
    expect(text).toContain('25/s');
    expect(text).toContain('1h 1m 1s');
  });

  it('hides the skill-tree bonus summary when no bonuses are active', () => {
    const wrapper = mount(ZealotStatsComponent, { props: defaultProps });
    expect(wrapper.text()).not.toContain('Dmg mult');
  });

  it('shows the bonus summary when a bonus is active', () => {
    const wrapper = mount(ZealotStatsComponent, {
      props: {
        ...defaultProps,
        bonuses: { ...DEFAULT_SKILL_BONUSES, damageMultiplier: 1.5 },
      },
    });
    const text = wrapper.text();
    expect(text).toContain('Dmg mult');
    expect(text).toContain('+50%');
  });
});