export function generateClassificationKey(label: string, existing: Set<string> = new Set()): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const keyBase = base || 'account';
  let key = `account_${keyBase}`;
  let suffix = 2;
  while (existing.has(key)) {
    key = `account_${keyBase}-${suffix++}`;
  }
  existing.add(key);
  return key;
}
