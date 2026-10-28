import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The automatic backup has to be a file the restore path accepts.
 *
 * The nightly job wrote the collector's output straight to storage: no top-level `userId`, no
 * `data` wrapper. `/api/restore-backup` checks `parsedData.userId` and reads `parsedData.data`,
 * so every automatic backup was rejected as "Unauthorized backup access" — it looked like a
 * backup and could not be restored. This pins the shape both writers produce.
 */

const storage = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserTransactions: vi.fn(),
  getUserBudgets: vi.fn(),
  getUserGoals: vi.fn(),
  getUserExpenseReminders: vi.fn(),
  getUserCollaborativeGoals: vi.fn(),
  getCategories: vi.fn(),
  getUserBackupSettings: vi.fn(),
  ensureBackupSettings: vi.fn(),
  updateBackupSettings: vi.fn(),
  getPremiumUsersForBackup: vi.fn(),
  getUsersWithOverdueBackups: vi.fn(),
}));

const cloud = vi.hoisted(() => ({
  createBackup: vi.fn(async () => 'backup-x.json'),
  cleanupOldBackups: vi.fn(async () => 0),
  getBackupInfo: vi.fn(async () => ({ totalBackups: 1, totalSize: 2048, oldestBackup: null, newestBackup: null })),
  getUserBackups: vi.fn(async () => []),
}));

vi.mock('../../server/storage', () => ({ storage }));
vi.mock('../../server/cloudStorage', () => ({ cloudStorage: cloud }));
vi.mock('../../server/errorGuard/jobs', () => ({ withJobRun: async (_name: string, fn: () => unknown) => fn() }));

const userId = 'user_1';

beforeEach(() => {
  vi.clearAllMocks();
  storage.getPremiumUsersForBackup.mockResolvedValue([{ userId, timeZone: 'America/Lima' }]);
  storage.getUsersWithOverdueBackups.mockResolvedValue([]);
  storage.getUser.mockResolvedValue({ id: userId, plan: 'premium', timezone: 'America/Lima' });
  storage.getUserTransactions.mockResolvedValue([{ id: 1, amount: '10.00' }]);
  storage.getUserBudgets.mockResolvedValue([]);
  storage.getUserGoals.mockResolvedValue([]);
  storage.getUserExpenseReminders.mockResolvedValue([]);
  storage.getUserCollaborativeGoals.mockResolvedValue([]);
  storage.getCategories.mockResolvedValue([{ id: 5, name: 'Bodega', userId }]);
  storage.getUserBackupSettings.mockResolvedValue({
    userId,
    autoBackup: true,
    frequency: 'daily',
    retentionDays: 30,
    lastBackupDate: null,
    status: 'active',
  });
  storage.ensureBackupSettings.mockResolvedValue({
    userId,
    autoBackup: true,
    frequency: 'daily',
    retentionDays: 30,
    lastBackupDate: null,
    status: 'active',
  });
  storage.updateBackupSettings.mockResolvedValue({});
});

describe('the automatic backup payload', () => {
  it('is restorable: a userId and a data object, like the manual one', async () => {
    const { backupScheduler } = await import('../../server/backupScheduler');

    await backupScheduler.triggerManualBackup(userId);

    expect(cloud.createBackup).toHaveBeenCalledTimes(1);
    const [, payload]: any = cloud.createBackup.mock.calls[0];

    expect(payload.userId).toBe(userId);
    expect(Array.isArray(payload.data.transactions)).toBe(true);
    expect(payload.data.transactions).toHaveLength(1);
    expect(payload.timestamp).toBeTruthy();
  });

  it('holds only that account\'s categories', async () => {
    const { backupScheduler } = await import('../../server/backupScheduler');

    await backupScheduler.triggerManualBackup(userId);

    // The collector asked for every account's categories before this; a backup is one person's data.
    expect(storage.getCategories).toHaveBeenCalledWith(userId);
  });

  it('records the run and the next one, so the tab stops saying "never"', async () => {
    const { backupScheduler } = await import('../../server/backupScheduler');

    await backupScheduler.triggerManualBackup(userId);

    const calls = storage.updateBackupSettings.mock.calls.map((call: any) => call[1]);
    const run = calls.find((arg: any) => arg?.lastBackupDate) as any;
    const scheduled = calls.find((arg: any) => arg?.nextBackupDate) as any;

    expect(run.lastBackupDate).toBeInstanceOf(Date);
    // The next run is 2 AM in Lima, which is 07:00 UTC.
    expect(scheduled.nextBackupDate).toBeInstanceOf(Date);
    expect(scheduled.nextBackupDate.toISOString()).toMatch(/T07:00:00\.000Z$/);
  });

});
