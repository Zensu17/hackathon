import { AppError } from '../../application/errors/AppError';
import type { Note, SyncQueueItem } from '../../domain/entities';
import {
  calculateBackoffDelayMs,
  shouldAutoDownloadMaterial,
} from '../../domain/rules';
import type { SyncService, SyncStateSummary } from '../../domain/services';
import type { LiteLearnDb } from '../local/LiteLearnDb';
import { domainClassToLocal } from '../mappers/classMapper';
import {
  domainAnnouncementToLocal,
  domainDeadlineToLocal,
  domainMaterialToLocal,
  domainNoteToLocal,
  domainWeekToLocal,
} from '../mappers/contentMapper';
import {
  domainCourseFollowToLocal,
  domainCourseToLocal,
} from '../mappers/courseMapper';
import { domainUserToLocal } from '../mappers/userMapper';
import type {
  HydratedCoursesContent,
  SupabaseRemoteDataSource,
} from '../remote/SupabaseRemoteDataSource';
import type { DexieSyncQueueRepository } from '../repositories/DexieSyncQueueRepository';
import type { HybridMaterialRepository } from '../repositories/HybridMaterialRepository';
import {
  extractQueueItemOwnerId,
  getPendingBlobMaterialIds,
  resolveActiveSessionUserId,
} from '../repositories/syncQueueHelpers';

export const LAST_SYNC_META_KEY = 'last_sync_at';
export const LAST_SYNC_USER_META_KEY = 'last_sync_user_id';
export const DATA_SAVER_META_KEY = 'data_saver_enabled';

export function lastSyncAtKeyForUser(userId: string): string {
  return `${LAST_SYNC_META_KEY}:${userId}`;
}

export function lastSyncCursorKeyForUser(userId: string): string {
  return `last_sync_cursor:${userId}`;
}

export function fullHydrationCoursesKeyForUser(userId: string): string {
  return `full_hydration_courses:${userId}`;
}

function collectMaxIsoTimestamp(timestamps: readonly (string | null | undefined)[]): string | null {
  let maxMs = Number.NEGATIVE_INFINITY;
  let maxIso: string | null = null;
  for (const value of timestamps) {
    if (!value) {
      continue;
    }
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed) && parsed > maxMs) {
      maxMs = parsed;
      maxIso = value;
    }
  }
  return maxIso;
}

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

  private async readScopedSyncMeta(
    userId: string | null,
    keyBuilder: (uid: string) => string,
  ): Promise<string | null> {
    if (userId) {
      const scoped = await this.db.meta.get(keyBuilder(userId));
      if (scoped?.value) {
        return scoped.value;
      }
      const ownerRow = await this.db.meta.get(LAST_SYNC_USER_META_KEY);
      if (ownerRow?.value && ownerRow.value !== userId) {
        return null;
      }
    }
    const legacy = await this.db.meta.get(LAST_SYNC_META_KEY);
    return legacy?.value ?? null;
  }

  private async loadCoursesNeedingFullHydration(
    userId: string,
  ): Promise<Set<string>> {
    const row = await this.db.meta.get(fullHydrationCoursesKeyForUser(userId));
    if (!row?.value) {
      return new Set<string>();
    }
    try {
      const parsed = JSON.parse(row.value) as unknown;
      if (Array.isArray(parsed)) {
        return new Set(
          parsed.filter((item): item is string => typeof item === 'string' && item.length > 0),
        );
      }
    } catch {
      // Ignore corrupt meta entry.
    }
    return new Set<string>();
  }

  private async saveCoursesNeedingFullHydration(
    userId: string,
    courseIds: ReadonlySet<string>,
  ): Promise<void> {
    const key = fullHydrationCoursesKeyForUser(userId);
    if (courseIds.size === 0) {
      if (typeof this.db.meta.delete === 'function') {
        await this.db.meta.delete(key);
      } else {
        await this.db.meta.put({ key, value: '[]' });
      }
      return;
    }
    await this.db.meta.put({
      key,
      value: JSON.stringify(Array.from(courseIds)),
    });
  }

  private belongsToUser(
    row: {
      userId?: string | null;
      entityType: SyncQueueItem['entityType'];
      payloadJson: string;
    },
    userId: string | null,
  ): boolean {
    if (!userId) {
      return true;
    }
    const owner = extractQueueItemOwnerId(row);
    return owner === null || owner === userId;
  }

  async getSyncState(explicitUserId?: string): Promise<SyncStateSummary> {
    const activeUserId =
      explicitUserId ?? (await resolveActiveSessionUserId(this.db));
    const [allRows, lastSyncAt] = await Promise.all([
      this.db.syncQueue.toArray(),
      this.readScopedSyncMeta(activeUserId, lastSyncAtKeyForUser),
    ]);
    const rows = allRows.filter((row) => this.belongsToUser(row, activeUserId));

    return {
      isSyncing: this.isSyncing,
      lastSyncAt,
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
      return this.getSyncState(userId);
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.lastError = 'Device is offline. Local changes remain queued safely.';
      return this.getSyncState(userId);
    }

    this.isSyncing = true;
    this.lastError = null;

    try {
      const nowIso = new Date().toISOString();
      const allPending = await this.syncQueueRepository.listPending(nowIso);
      const pendingItems = allPending.filter((item) =>
        this.belongsToUser(item, userId),
      );

      // Local fallback mode reconciles locally persisted changes without falsely claiming remote upload.
      if (this.remote === null) {
        for (const item of pendingItems) {
          await this.syncQueueRepository.remove(item.id);
        }

        const dataSaverEnabled = await this.getDataSaverEnabled();
        if (!dataSaverEnabled) {
          await this.prefetchSmallFollowedPdfs(userId);
        }

        const completedAt = new Date().toISOString();
        await this.db.meta.put({
          key: lastSyncAtKeyForUser(userId),
          value: completedAt,
        });
        await this.db.meta.put({
          key: LAST_SYNC_USER_META_KEY,
          value: userId,
        });

        this.isSyncing = false;
        return await this.getSyncState(userId);
      }

      const persistedHydrationIds = await this.loadCoursesNeedingFullHydration(
        userId,
      );

      // Remote Supabase mode: push queued operations sequentially, removing only after confirmation.
      for (const item of pendingItems) {
        try {
          const pushedCourseFollowId = await this.pushQueueItem(item);
          if (pushedCourseFollowId) {
            // Persist full-hydration marker BEFORE deleting queue item so mid-sync failure cannot drop hydration.
            persistedHydrationIds.add(pushedCourseFollowId);
            await this.saveCoursesNeedingFullHydration(
              userId,
              persistedHydrationIds,
            );
          }
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

      // Capture pull start watermark BEFORE pulls and BEFORE PDF prefetching to prevent skipping updates.
      const pullStartedAt = new Date().toISOString();
      const sinceIso = await this.readScopedSyncMeta(
        userId,
        lastSyncCursorKeyForUser,
      );

      const remainingQueueRows = (await this.db.syncQueue.toArray()).filter(
        (row) => this.belongsToUser(row, userId),
      );
      const pendingEntityKeys = new Set(
        remainingQueueRows.map((row) => `${row.entityType}:${row.entityId}`),
      );

      const observedServerTimestamps: (string | null | undefined)[] = [];

      // Refresh profile, class, and remote course follows when supported by the remote adapter.
      let userRow = await this.db.users.get(userId);
      if (typeof this.remote.fetchProfileById === 'function') {
        const remoteProfile = await this.remote.fetchProfileById(userId);
        if (remoteProfile) {
          observedServerTimestamps.push(remoteProfile.updatedAt);
          await this.db.users.put(domainUserToLocal(remoteProfile));
          userRow = domainUserToLocal(remoteProfile);
        }
      }

      if (
        userRow?.classId &&
        this.db.classes &&
        typeof this.remote.fetchClassById === 'function'
      ) {
        const remoteClass = await this.remote.fetchClassById(userRow.classId);
        if (remoteClass) {
          observedServerTimestamps.push(remoteClass.updatedAt);
          await this.db.classes.put(domainClassToLocal(remoteClass));
        }
      }

      if (typeof this.remote.fetchCourseFollowsByUserId === 'function') {
        const remoteFollows =
          await this.remote.fetchCourseFollowsByUserId(userId);
        const existingFollows = await this.db.courseFollows
          .where('userId')
          .equals(userId)
          .toArray();
        const existingCourseIds = new Set(
          existingFollows.map((row) => row.courseId),
        );
        const pendingFollowCourseIds = new Set<string>();
        for (const row of remainingQueueRows) {
          if (row.entityType !== 'course_follow') {
            continue;
          }
          try {
            const parsed = JSON.parse(row.payloadJson) as {
              courseId?: string;
            };
            if (parsed.courseId) {
              pendingFollowCourseIds.add(parsed.courseId);
            }
          } catch {
            // Ignore malformed follow queue payload.
          }
        }

        const remoteCourseIds = new Set(
          remoteFollows.map((follow) => follow.courseId),
        );
        const toDeleteIds = existingFollows
          .filter(
            (row) =>
              !remoteCourseIds.has(row.courseId) &&
              !pendingFollowCourseIds.has(row.courseId),
          )
          .map((row) => row.id);
        const toPutRows = remoteFollows
          .filter((follow) => !pendingFollowCourseIds.has(follow.courseId))
          .map(domainCourseFollowToLocal);

        for (const follow of remoteFollows) {
          if (
            !pendingFollowCourseIds.has(follow.courseId) &&
            !existingCourseIds.has(follow.courseId)
          ) {
            persistedHydrationIds.add(follow.courseId);
          }
        }

        if (toDeleteIds.length > 0) {
          await this.db.courseFollows.bulkDelete(toDeleteIds);
        }
        if (toPutRows.length > 0) {
          await this.db.courseFollows.bulkPut(toPutRows);
        }
        if (persistedHydrationIds.size > 0) {
          await this.saveCoursesNeedingFullHydration(
            userId,
            persistedHydrationIds,
          );
        }
      }

      // Delta pull for followed courses and user private notes after outbox push.
      if (userRow?.classId) {
        const remoteCourses = await this.remote.fetchCoursesByClassId(
          userRow.classId,
          sinceIso,
        );
        if (remoteCourses.length > 0) {
          for (const course of remoteCourses) {
            observedServerTimestamps.push(course.updatedAt);
          }
          const safeCourses = [];
          for (const remoteCourse of remoteCourses) {
            if (pendingEntityKeys.has(`course:${remoteCourse.id}`)) {
              continue;
            }
            const localCourse = await this.db.courses.get(remoteCourse.id);
            if (
              localCourse &&
              Date.parse(localCourse.updatedAt) >
                Date.parse(remoteCourse.updatedAt)
            ) {
              continue;
            }
            safeCourses.push(domainCourseToLocal(remoteCourse));
          }
          if (safeCourses.length > 0) {
            await this.db.courses.bulkPut(safeCourses);
          }
        }

        const follows = await this.db.courseFollows
          .where('userId')
          .equals(userId)
          .toArray();
        const followedCourseIds = Array.from(
          new Set(follows.map((f) => f.courseId)),
        );

        if (followedCourseIds.length > 0) {
          const freshIds = followedCourseIds.filter((id) =>
            persistedHydrationIds.has(id),
          );
          const incrementalIds = followedCourseIds.filter(
            (id) => !persistedHydrationIds.has(id),
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
              ? this.remote.fetchFollowedCoursesContent(
                  incrementalIds,
                  sinceIso,
                )
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

          for (const w of mergedContent.weeks) {
            observedServerTimestamps.push(w.updatedAt);
          }
          for (const m of mergedContent.materials) {
            observedServerTimestamps.push(m.updatedAt);
          }
          for (const d of mergedContent.deadlines) {
            observedServerTimestamps.push(d.updatedAt);
          }
          for (const a of mergedContent.announcements) {
            observedServerTimestamps.push(a.updatedAt);
          }

          await this.applyHydratedContent(mergedContent, pendingEntityKeys);

          // Only remove hydrated courses AFTER applyHydratedContent commits successfully.
          if (freshIds.length > 0) {
            for (const id of freshIds) {
              persistedHydrationIds.delete(id);
            }
            await this.saveCoursesNeedingFullHydration(
              userId,
              persistedHydrationIds,
            );
          }
        }
      }

      // Bidirectional private notes pull (skipping any locally pending or newer offline edits).
      const remoteNotes = await this.remote.fetchUserNotes(userId, sinceIso);
      if (remoteNotes.length > 0) {
        for (const note of remoteNotes) {
          observedServerTimestamps.push(note.updatedAt);
        }
        await this.mergeRemoteNotesSafely(userId, remoteNotes);
      }

      // Advance sync cursor BEFORE slow PDF prefetching using server max timestamp or pullStartedAt.
      if (!this.lastError) {
        const maxServerIso = collectMaxIsoTimestamp(observedServerTimestamps);
        const nextCursor = maxServerIso ?? sinceIso ?? pullStartedAt;
        await this.db.meta.put({
          key: lastSyncCursorKeyForUser(userId),
          value: nextCursor,
        });
        await this.db.meta.put({
          key: lastSyncAtKeyForUser(userId),
          value: pullStartedAt,
        });
        await this.db.meta.put({
          key: LAST_SYNC_USER_META_KEY,
          value: userId,
        });
      }

      const dataSaverEnabled = await this.getDataSaverEnabled();
      if (!dataSaverEnabled) {
        await this.prefetchSmallFollowedPdfs(userId);
      }
    } catch (err) {
      this.lastError =
        err instanceof Error ? err.message : 'Sync failed. Local data is intact.';
    } finally {
      this.isSyncing = false;
    }

    return this.getSyncState(userId);
  }

  private async applyHydratedContent(
    content: HydratedCoursesContent,
    pendingEntityKeys: ReadonlySet<string>,
  ): Promise<void> {
    if (
      content.weeks.length === 0 &&
      content.materials.length === 0 &&
      content.deadlines.length === 0 &&
      content.announcements.length === 0
    ) {
      return;
    }

    const pendingBlobIds = await getPendingBlobMaterialIds(this.db);

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
          const safeWeeks = [];
          for (const week of content.weeks) {
            if (pendingEntityKeys.has(`week:${week.id}`)) {
              continue;
            }
            const localWeek = await this.db.weeks.get(week.id);
            if (
              localWeek &&
              Date.parse(localWeek.updatedAt) > Date.parse(week.updatedAt)
            ) {
              continue;
            }
            safeWeeks.push(domainWeekToLocal(week));
          }
          if (safeWeeks.length > 0) {
            await this.db.weeks.bulkPut(safeWeeks);
          }
        }

        if (content.materials.length > 0) {
          const safeMaterials = [];
          const staleBlobIds: string[] = [];
          const cachedBlobIds = new Set(
            await this.db.materialBlobs
              .where('materialId')
              .anyOf(content.materials.map((m) => m.id))
              .primaryKeys(),
          );

          for (const material of content.materials) {
            if (pendingEntityKeys.has(`material:${material.id}`)) {
              continue;
            }
            const localRow = await this.db.materials.get(material.id);
            if (
              localRow &&
              Date.parse(localRow.updatedAt) > Date.parse(material.updatedAt)
            ) {
              continue;
            }

            const attachmentChanged =
              material.deletedAt !== null ||
              material.attachment === null ||
              (localRow !== undefined &&
                (localRow.attachmentStoragePath !==
                  material.attachment.storagePath ||
                  localRow.attachmentSizeBytes !==
                    material.attachment.sizeBytes ||
                  localRow.attachmentName !== material.attachment.name));

            if (
              attachmentChanged &&
              cachedBlobIds.has(material.id) &&
              !pendingBlobIds.has(material.id)
            ) {
              staleBlobIds.push(material.id);
              cachedBlobIds.delete(material.id);
            }

            safeMaterials.push(
              domainMaterialToLocal({
                ...material,
                isAvailableOffline:
                  material.deletedAt === null &&
                  material.attachment !== null &&
                  cachedBlobIds.has(material.id),
              }),
            );
          }

          if (staleBlobIds.length > 0) {
            await this.db.materialBlobs.bulkDelete(staleBlobIds);
          }
          if (safeMaterials.length > 0) {
            await this.db.materials.bulkPut(safeMaterials);
          }
        }

        if (content.deadlines.length > 0) {
          const safeDeadlines = [];
          for (const deadline of content.deadlines) {
            if (pendingEntityKeys.has(`deadline:${deadline.id}`)) {
              continue;
            }
            const localDeadline = await this.db.deadlines.get(deadline.id);
            if (
              localDeadline &&
              Date.parse(localDeadline.updatedAt) > Date.parse(deadline.updatedAt)
            ) {
              continue;
            }
            safeDeadlines.push(domainDeadlineToLocal(deadline));
          }
          if (safeDeadlines.length > 0) {
            await this.db.deadlines.bulkPut(safeDeadlines);
          }
        }

        if (content.announcements.length > 0) {
          const safeAnnouncements = [];
          for (const announcement of content.announcements) {
            if (pendingEntityKeys.has(`announcement:${announcement.id}`)) {
              continue;
            }
            const localAnnouncement = await this.db.announcements.get(
              announcement.id,
            );
            if (
              localAnnouncement &&
              Date.parse(localAnnouncement.updatedAt) >
                Date.parse(announcement.updatedAt)
            ) {
              continue;
            }
            safeAnnouncements.push(domainAnnouncementToLocal(announcement));
          }
          if (safeAnnouncements.length > 0) {
            await this.db.announcements.bulkPut(safeAnnouncements);
          }
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
      if (!this.belongsToUser(row, userId)) {
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

    await this.db.transaction('rw', this.db.notes, async () => {
      const existingLocalNotes = await this.db.notes
        .where('userId')
        .equals(userId)
        .toArray();
      const localByMaterialId = new Map<string, (typeof existingLocalNotes)[number][]>();
      for (const row of existingLocalNotes) {
        const group = localByMaterialId.get(row.materialId) ?? [];
        group.push(row);
        localByMaterialId.set(row.materialId, group);
      }

      for (const remoteNote of remoteNotes) {
        if (pendingNoteMaterialIds.has(remoteNote.materialId)) {
          continue;
        }
        const localRows = localByMaterialId.get(remoteNote.materialId) ?? [];
        const newestLocalMs = localRows.reduce((max, row) => {
          const parsed = Date.parse(row.updatedAt);
          return !Number.isNaN(parsed) && parsed > max ? parsed : max;
        }, Number.NEGATIVE_INFINITY);
        const remoteMs = Date.parse(remoteNote.updatedAt);
        if (
          localRows.length > 0 &&
          !Number.isNaN(remoteMs) &&
          newestLocalMs > remoteMs
        ) {
          continue;
        }

        // Delete any local rows with mismatched UUIDs for the same [userId+materialId] to prevent duplicates.
        const staleIds = localRows
          .map((row) => row.id)
          .filter((id) => id !== remoteNote.id);
        if (staleIds.length > 0) {
          await this.db.notes.bulkDelete(staleIds);
        }
        await this.db.notes.put(domainNoteToLocal(remoteNote));
      }
    });
  }

  private async pushQueueItem(item: SyncQueueItem): Promise<string | null> {
    if (!this.remote) {
      return null;
    }

    const payload = JSON.parse(item.payloadJson) as Record<string, unknown>;

    if (item.entityType === 'note') {
      await this.remote.upsertNote({
        userId: String(payload.userId ?? ''),
        materialId: String(payload.materialId ?? ''),
        body: String(payload.body ?? ''),
        updatedAt:
          typeof payload.updatedAt === 'string' ? payload.updatedAt : undefined,
      });
      return null;
    }

    if (item.entityType === 'course_follow') {
      const targetUserId = String(payload.userId ?? '');
      const targetCourseId = String(payload.courseId ?? '');
      if (item.operation === 'delete') {
        await this.remote.deleteCourseFollow(targetUserId, targetCourseId);
        return null;
      }
      await this.remote.insertCourseFollow(targetUserId, targetCourseId);
      return targetCourseId;
    }

    if (item.entityType === 'course') {
      await this.remote.upsertCoursePayload(payload);
      return null;
    }

    if (item.entityType === 'week') {
      await this.remote.upsertWeekPayload(payload);
      return null;
    }

    if (item.entityType === 'deadline') {
      await this.remote.upsertDeadlinePayload(payload);
      return null;
    }

    if (item.entityType === 'announcement') {
      await this.remote.upsertAnnouncementPayload(payload);
      return null;
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

      if (payload.hasPendingBlob === true) {
        if (!classId || !courseId) {
          throw new AppError(
            'VALIDATION_ERROR',
            'Material sync payload is missing classId or courseId for PDF upload.',
          );
        }
        const blobRow = await this.db.materialBlobs.get(materialId);
        if (!blobRow || blobRow.blob.byteLength === 0) {
          throw new AppError(
            'STORAGE_ERROR',
            'Pending PDF file is missing from local storage and cannot be uploaded.',
          );
        }
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
        payload.removeAttachment = false;
      }

      const nextStoragePath =
        typeof payload.attachmentStoragePath === 'string' &&
        payload.attachmentStoragePath.length > 0
          ? payload.attachmentStoragePath
          : null;

      // Never delete the newly uploaded file if its storage path matches previousStoragePath.
      if (
        previousStoragePath &&
        previousStoragePath !== nextStoragePath &&
        (payload.removeAttachment === true || payload.hasPendingBlob === true)
      ) {
        await this.remote.deleteMaterialPdf(previousStoragePath);
      }

      await this.remote.upsertMaterialPayload(payload);
    }

    return null;
  }

  private async prefetchSmallFollowedPdfs(userId: string): Promise<void> {
    const follows = await this.db.courseFollows
      .where('userId')
      .equals(userId)
      .toArray();
    const followedCourseIds = Array.from(
      new Set(follows.map((f) => f.courseId)),
    );
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
            'application/pdf',
          );
        } catch {
          // Stop prefetching silently on failure without blocking text sync.
          break;
        }
      }
    }
  }
}
