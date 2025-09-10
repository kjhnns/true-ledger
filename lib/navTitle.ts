export const navTitleForIndex = (
  index: number,
  analysisTitle: string,
  routes: { title: string }[],
): string =>
  index === 0
    ? 'Transactions'
    : index === 1
    ? analysisTitle
    : routes[index]?.title ?? '';
