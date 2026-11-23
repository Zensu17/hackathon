import type { Note, SyncQueueItem } from '../../domain/entities';
import {
  calculateBackoffDelayMs,
  shouldAutoDownloadMaterial,
} from '../../domain/rules';
import type { SyncService, SyncStateSummary } from '../../domain/services';
import type { LiteLearnDb } from '../local/LiteLearnDb';
import {
  domainAnnouncementToLocal,
  domainDeadlineToLocal,
  domainMaterialToLocal,
  domainNoteToLocal,
  domainWeekToLocal,
} from '../mappers/contentMapper';
import { domainCourseToLocal } from '../mappers/courseMapper';
import type {
  HydratedCoursesContent,
  SupabaseRemoteDataSource,
} from '../remote/SupabaseRemoteDataSource';
import type { DexieSyncQueueRepository } from '../repositories/DexieSyncQueueRepository';
import type { HybridMaterialRepository } from '../repositories/HybridMaterialRepository';

export const LAST_SYNC_META_KEY = 'last_sync_at';
export const DATA_SAVER_META_KEY = 'data_saver_enabled';

export class LiteLearnSyncService implements SyncService {
  private isSyncing = false;
  private lastError: string | null = null;

  constructor(
    private readonly db: LiteLearnDb,
    private readonly syncQueueRepository: DexieSyncQueueRepository,
    private readonly materialRepository: HybridMaterialRepository,
    private readonly remote: SupabaseRemoteDataSource | null,
  ) {}

  async getDataSaverEnabled(): Promise<boolean> {
    const row = await this.db.meta.get(DATA_SAVER_META_KEY);
    if (!row) {
      return true;
    }
    return row.value !== 'false';
  }

  async setDataSaverEnabled(enabled: boolean): Promise<void> {
    await this.db.meta.put({
      key: DATA_SAVER_META_KEY,
      value: enabled ? 'true' : 'false',
    });
  }

  async getSyncState(): Promise<SyncStateSummary> {
    const [rows, lastSyncRow] = await Promise.all([
      this.db.syncQueue.toArray(),
      this.db.meta.get(LAST_SYNC_META_KEY),
    ]);

    return {
      isSyncing: this.isSyncing,
      lastSyncAt: lastSyncRow?.value ?? null,
      pendingCount: rows.length,
      hasFailedChanges: rows.some((row) => Boolean(row.lastError)),
      lastError: this.lastError,
      mode: this.remote ? 'remote' : 'local',
    };
  }

  async retryFailed(userId: string): Promise<SyncStateSummary> {
    await this.syncQueueRepository.clearFailureState();
    this.lastError = null;
    return this.syncNow(userId);
  }

  async syncNow(userId: string): Promise<SyncStateSummary> {
    if (this.isSyncing) {
      return this.getSyncState();
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.lastError = 'Device is offline. Local changes remain queued safely.';
      return this.getSyncState();
    }

    this.isSyncing = true;
    this.lastError = null;

    try {
      const nowIso = new Date().toISOString();
      const pendingItems = await this.syncQueueRepository.listPending(nowIso);

      // Local fallback mode reconciles locally persisted changes without falsely claiming remote upload.
      if (this.remote === null) {
        for (const item of pendingItems) {
          await this.syncQueueRepository.remove(item.id);
        }

        const dataSaverEnabled = await this.getDataSaverEnabled();
        if (!dataSaverEnabled) {
          await this.prefetchSmallFollowedPdfs(userId);
        }

        await this.db.meta.put({
          key: LAST_SYNC_META_KEY,
          value: new Date().toISOString(),
        });

        return await this.getSyncState();
      }

      const newlyFollowedCourseIds = new Set<string>();

      // Remote Supabase mode: push queued operations sequentially, removing only after confirmation.
      for (const item of pendingItems) {
        try {
          await this.pushQueueItem(item, newlyFollowedCourseIds);
          await this.syncQueueRepository.remove(item.id);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Sync upload failed.';
          const delayMs = calculateBackoffDelayMs(item.attempts);
          const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
          await this.syncQueueRepository.markFailed(
            item.id,
            message,
            nextRetryAt,
          );
          this.lastError = message;
        }
      }

      const lastSyncRow = await this.db.meta.get(LAST_SYNC_META_KEY);
      const sinceIso = lastSyncRow?.value ?? null;

      // Delta pull for followed courses and user private notes after outbox push.
      const userRow = await this.db.users.get(userId);
      if (userRow?.classId) {
        const remoteCourses = await this.remote.fetchCoursesByClassId(
          userRow.classId,
          sinceIso,
        );
        if (remoteCourses.length > 0) {
          await this.db.courses.bulkPut(remoteCourses.map(domainCourseToLocal));
        }

        const follows = await this.db.courseFollows
          .where('userId')
          .equals(userId)
          .toArray();
        const followedCourseIds = follows.map((f) => f.courseId);

        if (followedCourseIds.length > 0) {
          const freshIds = followedCourseIds.filter((id) =>
            newlyFollowedCourseIds.has(id),
          );
          const incrementalIds = followedCourseIds.filter(
            (id) => !newlyFollowedCourseIds.has(id),
          );

          const [freshContent, deltaContent] = await Promise.all([
            freshIds.length > 0
              ? this.remote.fetchFollowedCoursesContent(freshIds, null)
              : Promise.resolve<HydratedCoursesContent>({
                  weeks: [],
                  materials: [],
                  deadlines: [],
                  announcements: [],
                }),
            incrementalIds.length > 0
              ? this.remote.fetchFollowedCoursesContent(incrementalIds, sinceIso)
              : Promise.resolve<HydratedCoursesContent>({
                  weeks: [],
                  materials: [],
                  deadlines: [],
                  announcements: [],
                }),
          ]);

          const mergedContent: HydratedCoursesContent = {
            weeks: [...freshContent.weeks, ...deltaContent.weeks],
            materials: [...freshContent.materials, ...deltaContent.materials],
            deadlines: [...freshContent.deadlines, ...deltaContent.deadlines],
            announcements: [
              ...freshContent.announcements,
              ...deltaContent.announcements,
            ],
          };

          await this.applyHydratedContent(mergedContent);
        }
      }

      // Bidirectional private notes pull (skipping any locally pending or newer offline edits).
      const remoteNotes = await this.remote.fetchUserNotes(userId, sinceIso);
      if (remoteNotes.length > 0) {
        await this.mergeRemoteNotesSafely(userId, remoteNotes);
      }

      const dataSaverEnabled = await this.getDataSaverEnabled();
      if (!dataSaverEnabled) {
        await this.prefetchSmallFollowedPdfs(userId);
      }

      if (!this.lastError) {
        await this.db.meta.put({
          key: LAST_SYNC_META_KEY,
          value: new Date().toISOString(),
        });
      }
    } catch (err) {
      this.lastError =
        err instanceof Error ? err.message : 'Sync failed. Local data is intact.';
    } finally {
      this.isSyncing = false;
    }

    return this.getSyncState();
  }

  private async applyHydratedContent(
    content: HydratedCoursesContent,
  ): Promise<void> {
    if (
      content.weeks.length === 0 &&
      content.materials.length === 0 &&
      content.deadlines.length === 0 &&
      content.announcements.length === 0
    ) {
      return;
    }

    await this.db.transaction(
      'rw',
      [
        this.db.weeks,
        this.db.materials,
        this.db.materialBlobs,
        this.db.deadlines,
        this.db.announcements,
      ],
      async () => {
        if (content.weeks.length > 0) {
          await this.db.weeks.bulkPut(content.weeks.map(domainWeekToLocal));
        }
        if (content.materials.length > 0) {
          const cachedBlobIds = new Set(
            await this.db.materialBlobs
              .where('materialId')
              .anyOf(content.materials.map((m) => m.id))
              .primaryKeys(),
          );
          await this.db.materials.bulkPut(
            content.materials.map((material) =>
              domainMaterialToLocal({
                ...material,
                isAvailableOffline: cachedBlobIds.has(material.id),
              }),
            ),
          );
        }
        if (content.deadlines.length > 0) {
          await this.db.deadlines.bulkPut(
            content.deadlines.map(domainDeadlineToLocal),
          );
        }
        if (content.announcements.length > 0) {
          await this.db.announcements.bulkPut(
            content.announcements.map(domainAnnouncementToLocal),
          );
        }
      },
    );
  }

  private async mergeRemoteNotesSafely(
    userId: string,
    remoteNotes: readonly Note[],
  ): Promise<void> {
    const remainingQueue = await this.db.syncQueue.toArray();
    const pendingNoteMaterialIds = new Set<string>();
    for (const row of remainingQueue) {
      if (row.entityType !== 'note') {
        continue;
      }
      try {
        const parsed = JSON.parse(row.payloadJson) as { materialId?: string };
        if (parsed.materialId) {
          pendingNoteMaterialIds.add(parsed.materialId);
        }
      } catch {
        // Ignore malformed queue payload during conflict check.
      }
    }

    const existingLocalNotes = await this.db.notes
      .where('userId')
      .equals(userId)
      .toArray();
    const localByMaterialId = new Map(
      existingLocalNotes.map((row) => [row.materialId, row]),
    );

    const safeToApply: Note[] = [];
    for (const remoteNote of remoteNotes) {
      if (pendingNoteMaterialIds.has(remoteNote.materialId)) {
        continue;
      }
      const localRow = localByMaterialId.get(remoteNote.materialId);
      if (
        localRow &&
        Date.parse(localRow.updatedAt) > Date.parse(remoteNote.updatedAt)
      ) {
        continue;
      }
      safeToApply.push(remoteNote);
    }

    if (safeToApply.length > 0) {
      await this.db.notes.bulkPut(safeToApply.map(domainNoteToLocal));
    }
  }

  private async pushQueueItem(
    item: SyncQueueItem,
    newlyFollowedCourseIds: Set<string>,
  ): Promise<void> {
    if (!this.remote) {
      return;
    }

    const payload = JSON.parse(item.payloadJson) as Record<string, unknown>;

    if (item.entityType === 'note') {
      await this.remote.upsertNote({
        userId: String(payload.userId ?? ''),
        materialId: String(payload.materialId ?? ''),
        body: String(payload.body ?? ''),
      });
      return;
    }

    if (item.entityType === 'course_follow') {
      const targetUserId = String(payload.userId ?? '');
      const targetCourseId = String(payload.courseId ?? '');
      if (item.operation === 'delete') {
        await this.remote.deleteCourseFollow(targetUserId, targetCourseId);
      } else {
        await this.remote.insertCourseFollow(targetUserId, targetCourseId);
        newlyFollowedCourseIds.add(targetCourseId);
      }
      return;
    }

    if (item.entityType === 'course') {
      await this.remote.upsertCoursePayload(payload);
      return;
    }

    if (item.entityType === 'week') {
      await this.remote.upsertWeekPayload(payload);
      return;
    }

    if (item.entityType === 'deadline') {
      await this.remote.upsertDeadlinePayload(payload);
      return;
    }

    if (item.entityType === 'announcement') {
      await this.remote.upsertAnnouncementPayload(payload);
      return;
    }

    if (item.entityType === 'material') {
      const materialId = String(payload.id ?? item.entityId);
      const classId = String(payload.classId ?? '');
      const courseId = String(payload.courseId ?? '');
      const previousStoragePath =
        typeof payload.previousStoragePath === 'string' &&
        payload.previousStoragePath.length > 0
          ? payload.previousStoragePath
          : null;

      if (payload.hasPendingBlob === true && classId && courseId) {
        const blobRow = await this.db.materialBlobs.get(materialId);
        if (blobRow && blobRow.blob.byteLength > 0) {
          const uploaded = await this.remote.uploadMaterialPdf({
            classId,
            courseId,
            materialId,
            file: {
              name: String(payload.attachmentName ?? 'attachment.pdf'),
              sizeBytes: Number(
                payload.attachmentSizeBytes ?? blobRow.blob.byteLength,
              ),
              mimeType: 'application/pdf',
              bytes: blobRow.blob,
            },
          });
          payload.attachmentStoragePath = uploaded.storagePath;
          payload.attachmentMimeType = 'application/pdf';
          payload.attachmentSizeBytes = blobRow.blob.byteLength;
        }
      }

      if (payload.removeAttachment === true && previousStoragePath) {
        await this.remote.deleteMaterialPdf(previousStoragePath);
      }

      await this.remote.upsertMaterialPayload(payload);
    }
  }

  private async prefetchSmallFollowedPdfs(userId: string): Promise<void> {
    const follows = await this.db.courseFollows
      .where('userId')
      .equals(userId)
      .toArray();
    const followedCourseIds = follows.map((f) => f.courseId);
    if (followedCourseIds.length === 0) {
      return;
    }

    const materials =
      await this.materialRepository.listByCourseIds(followedCourseIds);
    for (const material of materials) {
      if (
        material.attachment &&
        !material.isAvailableOffline &&
        shouldAutoDownloadMaterial(material.attachment.sizeBytes, false)
      ) {
        try {
          const downloaded =
            await this.materialRepository.downloadRemoteFile(material);
          await this.materialRepository.saveOfflineFile(
            material.id,
            downloaded.bytes,
            downloaded.mimeType,
          );
        } catch {
          // Stop prefetching silently on failure without blocking text sync.
          break;
        }
      }
    }
  }
}
