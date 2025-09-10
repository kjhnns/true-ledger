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

  it('returns provided title for analysis tab', () => {
    expect(navTitleForIndex(1, 'March', routes)).toBe('March');
  });

  it('falls back to route title for others', () => {
    expect(navTitleForIndex(2, 'Ignored', routes)).toBe('Settings');
  });
});
