import { navTitleForIndex } from '../lib/navigation';

test('navTitleForIndex maps indexes to titles', () => {
  expect(navTitleForIndex(0)).toBe('Transactions');
  expect(navTitleForIndex(1)).toBe('Analysis');
  expect(navTitleForIndex(2)).toBe('Settings');
});

test('navTitleForIndex returns empty string for unknown index', () => {
  expect(navTitleForIndex(5)).toBe('');
});
