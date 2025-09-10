export const navTitleForIndex = (
  index: number,
  _analysisTitle: string,
  routes: { title: string }[],
): string =>
  index === 0
    ? 'Transactions'
    : index === 1
    ? 'Analysis'
    : routes[index]?.title ?? '';
