// SQLiteDB.open() must hand the database out only after the migrations finished,
// to every caller, not just the one that started the open. A stand-in expo-sqlite
// and a migration we finish by hand make the order visible.

const mockEvents: string[] = [];
const mockPendingMigrations: (() => void)[] = [];
const mockFinishMigration = () => mockPendingMigrations.splice(0).forEach(finish => finish());
const mockOpenDatabase = jest.fn(async () => mockFakeDb);
const mockRunMigrations = jest.fn(
  () =>
    new Promise<string>(resolve => {
      mockPendingMigrations.push(() => {
        mockEvents.push('migrated');
        resolve('en-es');
      });
    }),
);

const mockFakeDb = {
  getFirstAsync: jest.fn(async () => {
    mockEvents.push('query');
    return { current_count: 0, last_date: null, longest_count: 0 };
  }),
};

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: () => mockOpenDatabase() }));
// jest.setup.js maps the database to the sql.js one; this test is about the native layer.
jest.unmock('../database');
jest.mock('../db/migrations', () => ({ runMigrations: () => mockRunMigrations() }));

import type { getDb as GetDb } from '../database';

let getDb: typeof GetDb;

beforeEach(() => {
  mockEvents.length = 0;
  mockPendingMigrations.length = 0;
  mockOpenDatabase.mockClear();
  mockRunMigrations.mockClear();
  jest.isolateModules(() => {
    getDb = require('../database').getDb;
  });
});

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('SQLiteDB.open (native db)', () => {
  it('two quick calls both wait for the migration to finish before they get the db', async () => {
    const first = getDb().getStreak();
    const second = getDb().getStreak();
    await flush();
    expect(mockEvents).toEqual([]);

    mockFinishMigration();
    await Promise.all([first, second]);

    expect(mockEvents).toEqual(['migrated', 'query', 'query']);
    expect(mockOpenDatabase).toHaveBeenCalledTimes(1);
    expect(mockRunMigrations).toHaveBeenCalledTimes(1);
  });

  it('a call that arrives while the migration is still running waits for it', async () => {
    const first = getDb().getStreak();
    await flush();
    const late = getDb().getStreak();
    await flush();
    expect(mockEvents).toEqual([]);

    mockFinishMigration();
    await Promise.all([first, late]);

    expect(mockEvents).toEqual(['migrated', 'query', 'query']);
    expect(mockRunMigrations).toHaveBeenCalledTimes(1);
  });

  it('a call after the migration finished reuses the db without migrating again', async () => {
    const first = getDb().getStreak();
    await flush();
    mockFinishMigration();
    await first;

    await getDb().getStreak();

    expect(mockEvents).toEqual(['migrated', 'query', 'query']);
    expect(mockOpenDatabase).toHaveBeenCalledTimes(1);
    expect(mockRunMigrations).toHaveBeenCalledTimes(1);
  });
});
