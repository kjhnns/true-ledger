export interface CategorySeed {
  label: string;
  children?: CategorySeed[];
}

export const DEFAULT_EXPENSE_CATEGORIES: CategorySeed[] = [
  {
    label: 'Food',
    children: [
      { label: 'Groceries' },
      { label: 'Restaurant' },
      { label: 'Delivery' },
      { label: 'Bar/Cafe' },
    ],
  },
  {
    label: 'Shopping',
    children: [
      { label: 'Clothes & Shoes' },
      { label: 'Accessories' },
      { label: 'Health' },
      { label: 'Home & Garden' },
      { label: 'Electronics' },
      { label: 'Gifts' },
      { label: 'Tools' },
      { label: 'Drugstore' },
    ],
  },
  {
    label: 'Housing',
    children: [
      { label: 'Rent' },
      { label: 'Utilities' },
      { label: 'Services' },
      { label: 'Repairs' },
      { label: 'Insurance' },
    ],
  },
  {
    label: 'Transport',
    children: [
      { label: 'Public Transport' },
      { label: 'Taxi' },
      { label: 'Flight' },
      { label: 'Business Trip' },
    ],
  },
  {
    label: 'Vehicle',
    children: [
      { label: 'Rental' },
      { label: 'Fuel' },
    ],
  },
  {
    label: 'Travel',
    children: [
      { label: 'Hotel' },
      { label: 'Apartment' },
    ],
  },
  {
    label: 'Lifestyle',
    children: [
      { label: 'Healthcare' },
      { label: 'Wellness' },
      { label: 'Sports' },
      { label: 'Events' },
      { label: 'Hobbies' },
      { label: 'Education' },
      { label: 'Books' },
      { label: 'Media Subscriptions' },
      { label: 'Holiday' },
      { label: 'Gifts' },
      { label: 'Alcohol' },
    ],
  },
  {
    label: 'Digital',
    children: [
      { label: 'Internet' },
      { label: 'Service' },
      { label: 'App' },
      { label: 'Phone' },
    ],
  },
  {
    label: 'Financial',
    children: [
      { label: 'Taxes' },
      { label: 'Fee' },
      { label: 'Fines' },
      { label: 'Loan' },
      { label: 'Insurance' },
    ],
  },
];

export const DEFAULT_INCOME_CATEGORIES = [
  'Salary',
  'Refunds',
  'Sale',
  'Gift',
  'Invoices',
  'Other',
];

export const DEFAULT_SAVINGS_CATEGORIES = [
  'General',
  'Investments',
  'Other',
];

