export const navigationTitles = ['Transactions', 'Analysis', 'Settings'] as const;

export const navTitleForIndex = (index: number): string =>
  navigationTitles[index] ?? '';
