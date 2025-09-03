jest.mock('expo-sqlite', () => require('../test-utils/sqliteMock').sqliteMock);

import {
  createBankAccount,
  deleteBankAccount,
  getBankAccount,
  listBankAccounts,
  listEntities,
  updateBankAccount,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  listExpenseCategories,
  createEntity,
  deleteEntity,
  groupEntitiesByCategory,
} from '../lib/entities';
import { initDb } from '../lib/db';
const sqlite = require('expo-sqlite');

beforeEach(async () => {
  sqlite.__reset();
  await initDb();
});

test('seeds default expense categories', async () => {
  const expenses = await listEntities('expense');
  expect(expenses.find((c) => c.label === 'Food')).toBeTruthy();
  expect(expenses.find((c) => c.label === 'Groceries')).toBeTruthy();
});

test('seeds default income and savings categories', async () => {
  const incomes = await listEntities('income');
  const savings = await listEntities('savings');
  expect(incomes.find((c) => c.label === 'Salary')).toBeTruthy();
  expect(savings.find((c) => c.label === 'General')).toBeTruthy();
});

test('create, update, delete bank account', async () => {
  const created = await createBankAccount({
    label: 'Checking',
    prompt: 'p',
    currency: 'USD',
  });
  const fetched = await getBankAccount(created.id);
  expect(fetched?.category).toBe('bank');
  expect(fetched?.currency).toBe('USD');
  await updateBankAccount(created.id, {
    label: 'New',
    prompt: 'p2',
    currency: 'EUR',
  });
  const updated = await getBankAccount(created.id);
  expect(updated?.label).toBe('New');
  expect(updated?.currency).toBe('EUR');
  await deleteBankAccount(created.id);
  const list = await listBankAccounts();
  expect(list.length).toBe(0);
});

test('create bank account without prompt', async () => {
  const created = await createBankAccount({ label: 'NoPrompt', currency: 'USD' });
  expect(created.prompt).toBe('');
});

test('create and delete income category', async () => {
  const item = await createEntity({
    label: 'Bonus',
    category: 'income',
    prompt: 'Bonus',
    parentId: null,
    currency: 'USD',
  });
  let list = await listEntities('income');
  expect(list.find((c) => c.id === item.id)).toBeTruthy();
  await deleteEntity(item.id);
  list = await listEntities('income');
  expect(list.find((c) => c.id === item.id)).toBeFalsy();
});

test('reject invalid currency', async () => {
  await expect(
    createBankAccount({ label: 'A', prompt: 'p', currency: 'ZZZ' as any })
  ).rejects.toThrow();
});

test('create, update, delete expense category with parent', async () => {
  const parent = await createExpenseCategory({
    label: 'Parent',
    prompt: 'p',
    parentId: null,
  });
  const child = await createExpenseCategory({
    label: 'Child',
    prompt: 'p',
    parentId: parent.id,
  });
  let list = await listExpenseCategories();
  expect(list.find((c) => c.id === child.id)?.parentId).toBe(parent.id);
  await updateExpenseCategory(child.id, {
    label: 'Child2',
    prompt: 'p2',
    parentId: null,
  });
  list = await listExpenseCategories();
  const updatedChild = list.find((c) => c.id === child.id);
  expect(updatedChild?.label).toBe('Child2');
  expect(updatedChild?.parentId).toBeNull();
  await deleteExpenseCategory(child.id);
  await deleteExpenseCategory(parent.id);
  list = await listExpenseCategories();
  expect(list.find((c) => c.id === parent.id)).toBeFalsy();
  expect(list.find((c) => c.id === child.id)).toBeFalsy();
});

test('groupEntitiesByCategory groups by category', () => {
  const grouped = groupEntitiesByCategory([
    {
      id: '1',
      label: 'Income1',
      category: 'income',
      prompt: '',
      parentId: null,
      currency: 'USD',
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: '2',
      label: 'Expense1',
      category: 'expense',
      prompt: '',
      parentId: null,
      currency: 'USD',
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: '3',
      label: 'Income2',
      category: 'income',
      prompt: '',
      parentId: null,
      currency: 'USD',
      createdAt: 0,
      updatedAt: 0,
    },
  ]);
  expect(grouped.income.length).toBe(2);
  expect(grouped.expense[0].id).toBe('2');
});

test('groupEntitiesByCategory handles empty list', () => {
  expect(groupEntitiesByCategory([])).toEqual({});
});
