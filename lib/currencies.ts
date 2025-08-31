export const SUPPORTED_CURRENCIES = [
  'EUR',
  'USD',
  'CHF',
  'BRL',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'CNY',
  'SEK',
  'NZD',
  'MXN',
  'INR',
  'HKD',
  'SGD',
  'KRW',
  'NOK',
  'TRY',
  'RUB',
  'ZAR',
] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];
