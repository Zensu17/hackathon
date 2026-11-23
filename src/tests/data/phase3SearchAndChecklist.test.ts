import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ToggleDeadlineCompletion } from '../../application/usecases';
import type { LocalDeadlineCompletionRow, LiteLearnDb } from '../../data/local/LiteLearnDb';
import { DexieDeadlineCompletionRepository } from '../../data/repositories/DexieDeadlineCompletionRepository';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');

function createFakeCompletionDb() {
  const rows = new Map<string, LocalDeadlineCompletionRow>();
  let notifications = 0;

  const db = {
    deadlineCompletions: {
      async put(row: LocalDeadlineCompletionRow) {
        rows.set(row.id, row);
        return row.id;
      },
      async delete(id: string) {
        rows.delete(id);
      },
      where(field: string) {
        return {
          equals(val: string) {
            return {
              async toArray() {
                return [...rows.values()].filter(
                  (r) => r[field as keyof LocalDeadlineCompletionRow] === val,
                );
              },
            };
          },
        };
      },
    },
    notifyDeadlineCompletionsChanged() {
      notifications += 1;
    },
    getNotificationCount() {
      return notifications;
    },
  };

  return db;
}

describe('Phase 3 Quick Search (Cmd/Ctrl + K) & Personal Deadline Completion Checklist', () => {
  it('toggles and persists per-student deadline completion state in IndexedDB', async () => {
    const fakeDb = createFakeCompletionDb();
    const repo = new DexieDeadlineCompletionRepository(
      fakeDb as unknown as LiteLearnDb,
    );
    const toggleUseCase = new ToggleDeadlineCompletion(repo);

    expect(await repo.listCompletedDeadlineIds('user-1')).toEqual([]);

    // First toggle marks deadline-1 as completed for user-1
    const firstState = await toggleUseCase.execute({
      userId: 'user-1',
      deadlineId: 'deadline-1',
    });
    expect(firstState).toBe(true);
    expect(await repo.listCompletedDeadlineIds('user-1')).toEqual(['deadline-1']);
    expect(await repo.listCompletedDeadlineIds('user-2')).toEqual([]);
    expect(fakeDb.getNotificationCount()).toBe(1);

    // Explicit undo (completed: false) removes completion
    const undoneState = await toggleUseCase.execute({
      userId: 'user-1',
      deadlineId: 'deadline-1',
      completed: false,
    });
    expect(undoneState).toBe(false);
    expect(await repo.listCompletedDeadlineIds('user-1')).toEqual([]);
    expect(fakeDb.getNotificationCount()).toBe(2);
  });

  it('wires Cmd/Ctrl+K QuickSearchModal and additive Dexie version(4) schema cleanly', () => {
    const dbSource = fs.readFileSync(
      path.join(repoRoot, 'src', 'data', 'local', 'LiteLearnDb.ts'),
      'utf8',
    );
    expect(dbSource).toContain('this.version(4).stores({');
    expect(dbSource).toContain(
      "deadlineCompletions: 'id, userId, deadlineId, [userId+deadlineId]'",
    );

    const modalSource = fs.readFileSync(
      path.join(repoRoot, 'src', 'presentation', 'components', 'QuickSearchModal.tsx'),
      'utf8',
    );
    expect(modalSource).toContain('role="dialog"');
    expect(modalSource).toContain('aria-modal="true"');
    expect(modalSource).toContain("event.key === 'ArrowDown'");
    expect(modalSource).toContain("event.key === 'ArrowUp'");
    expect(modalSource).toContain("event.key === 'Escape'");

    const layoutSource = fs.readFileSync(
      path.join(repoRoot, 'src', 'presentation', 'components', 'AppLayout.tsx'),
      'utf8',
    );
    expect(layoutSource).toContain("event.key.toLowerCase() === 'k'");
    expect(layoutSource).toContain('<QuickSearchModal');
  });
});
