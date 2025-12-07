type SecureStoreType = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

let SecureStore: SecureStoreType;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SecureStore = require('expo-secure-store');
} catch (e) {
  // In-memory fallback for test environments only
  const memoryStore = new Map<string, string>();
  SecureStore = {
    getItemAsync: async (key: string) => memoryStore.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => { memoryStore.set(key, value); },
  };
}

export const SHARED_PERCENT_KEY = 'default_shared_percent';
export const DEFAULT_SHARED_PERCENT = 50;

export async function getDefaultSharedPercent(): Promise<number> {
  const val = await SecureStore.getItemAsync(SHARED_PERCENT_KEY);
  const num = val ? Number(val) : NaN;
  return !isNaN(num) && num >= 0 && num <= 100 ? num : DEFAULT_SHARED_PERCENT;
}

export async function setDefaultSharedPercent(val: number): Promise<void> {
  if (!isFinite(val) || val < 0 || val > 100) return;
  await SecureStore.setItemAsync(SHARED_PERCENT_KEY, String(Math.round(val)));
}
