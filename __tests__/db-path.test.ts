jest.mock('expo-sqlite', () => require('../test-utils/sqliteMock').sqliteMock);

import { getDb, getDbFileInfo, initDb, setDbFilePath } from '../lib/db';
const sqlite = require('expo-sqlite');

describe('database file management', () => {
  beforeEach(async () => {
    sqlite.__reset();
    await setDbFilePath('file:///mock/SQLite/app_v3.db');
  });

  test('getDbFileInfo exposes the current database path', async () => {
    const info = await getDbFileInfo();
    expect(info.fileName).toBe('app_v3.db');
    expect(info.directory).toBe('file:///mock/SQLite');
    expect(info.path).toBe('file:///mock/SQLite/app_v3.db');
  });

  test('setDbFilePath normalizes file names and closes existing database', async () => {
    await initDb();
    const initialCloseCount = sqlite.__getCloseCount();
    await setDbFilePath('custom.db');
    const info = await getDbFileInfo();
    expect(info.fileName).toBe('custom.db');
    expect(info.directory).toBe('file:///mock/SQLite');
    expect(info.path).toBe('file:///mock/SQLite/custom.db');
    expect(sqlite.__getCloseCount()).toBe(initialCloseCount + 1);
  });

  test('database remains accessible after changing path', async () => {
    await setDbFilePath('file:///mock/SQLite/second.db');
    await initDb();
    const db = await getDb();
    await db.execAsync('SELECT 1;');
    const info = await getDbFileInfo();
    expect(info.fileName).toBe('second.db');
  });
});
