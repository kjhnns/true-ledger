jest.mock('expo-sqlite', () => require('../test-utils/sqliteMock').sqliteMock);

import { getDb } from '../lib/db';
const sqlite = require('expo-sqlite');

it('opens database lazily and only once', async () => {
  const openSpy = jest.spyOn(sqlite, 'openDatabaseAsync');
  expect(openSpy).not.toHaveBeenCalled();

  const first = await getDb();
  expect(openSpy).toHaveBeenCalledTimes(1);

  const second = await getDb();
  expect(openSpy).toHaveBeenCalledTimes(1);
  expect(second).toBe(first);
});
