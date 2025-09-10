import { navTitleForIndex } from '../lib/navTitle';

describe('navTitleForIndex', () => {
  const routes = [
    { title: 'Import' },
    { title: 'Analysis' },
    { title: 'Settings' },
  ];

  it('returns Transactions for first tab', () => {
    expect(navTitleForIndex(0, 'Any', routes)).toBe('Transactions');
  });

  it('returns fixed title for analysis tab', () => {
    expect(navTitleForIndex(1, 'March', routes)).toBe('Analysis');
  });

  it('falls back to route title for others', () => {
    expect(navTitleForIndex(2, 'Ignored', routes)).toBe('Settings');
  });
});
