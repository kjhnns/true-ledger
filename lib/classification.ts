export function generateClassificationKey(label: string, existing: Set<string> = new Set()): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  let key = base || 'account';
  let suffix = 2;
  while (existing.has(key)) {
    key = `${base}-${suffix++}`;
  }
  existing.add(key);
  return key;
}
