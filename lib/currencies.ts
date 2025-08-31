export const SUPPORTED_CURRENCIES = [
  'EUR',
  'CHF',
  'USD',
  'BRL',
  'GBP',
  'JPY',
  'CAD',
  'AUD',
  'CNY',
  'SEK',
] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];
