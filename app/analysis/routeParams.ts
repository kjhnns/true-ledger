export function buildRouteParams(
  type: string,
  current: string[],
  existing: { income?: string; savings?: string }
): Record<string, string> {
  if (type === 'income') {
    return {
      income: current.join(','),
      ...(existing.savings ? { savings: existing.savings } : {}),
    };
  }
  if (type === 'savings') {
    return {
      savings: current.join(','),
      ...(existing.income ? { income: existing.income } : {}),
    };
  }
  return {};
}
