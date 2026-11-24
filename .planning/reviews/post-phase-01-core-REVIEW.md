---
phase: post-phase-01-core
reviewed: 2026-11-24T01:48:00Z
depth: standard
files_reviewed: 51
files_reviewed_list:
  - supabase/migrations/002_nim_auth.sql
  - supabase/migrations/003_sync_and_rls_hardening.sql
  - vercel.json
  - vite.config.ts
  - src/app/di.ts
  - src/domain/entities/User.ts
  - src/domain/repositories/AnnouncementRepository.ts
  - src/domain/repositories/AuthRepository.ts
  - src/domain/repositories/DeadlineCompletionRepository.ts
  - src/domain/repositories/MaterialRepository.ts
  - src/domain/repositories/SyncQueueRepository.ts
  - src/domain/repositories/index.ts
  - src/domain/rules/fileRules.ts
  - src/domain/rules/index.ts
  - src/domain/rules/nimRules.ts
  - src/domain/rules/syncRules.ts
  - src/domain/services/SyncService.ts
  - src/application/dto/AuthDto.ts
  - src/application/dto/OfflineDto.ts
  - src/application/dto/index.ts
  - src/application/errors/AppError.ts
  - src/application/usecases/announcements/ListRecentAnnouncements.ts
  - src/application/usecases/auth/SignIn.ts
  - src/application/usecases/auth/SignOut.ts
  - src/application/usecases/auth/SignUp.ts
  - src/application/usecases/content/DownloadMaterialFile.ts
  - src/application/usecases/content/GetOfflineMaterialFile.ts
  - src/application/usecases/content/GetOfflineStudyOverview.ts
  - src/application/usecases/content/RemoveOfflineMaterialFile.ts
  - src/application/usecases/deadlines/ToggleDeadlineCompletion.ts
  - src/application/usecases/index.ts
  - src/application/usecases/notes/GetMaterialNote.ts
  - src/application/usecases/notes/SaveMaterialNote.ts
  - src/application/usecases/search/SearchWorkspace.ts
  - src/application/usecases/sync/RunSync.ts
  - src/data/local/LiteLearnDb.ts
  - src/data/local/samplePdf.ts
  - src/data/local/seed.ts
  - src/data/mappers/userMapper.ts
  - src/data/remote/SupabaseRemoteDataSource.ts
  - src/data/remote/supabaseClient.ts
  - src/data/repositories/DexieDeadlineCompletionRepository.ts
  - src/data/repositories/DexieSyncQueueRepository.ts
  - src/data/repositories/HybridAnnouncementRepository.ts
  - src/data/repositories/HybridAuthRepository.ts
  - src/data/repositories/HybridCourseRepository.ts
  - src/data/repositories/HybridDeadlineRepository.ts
  - src/data/repositories/HybridMaterialRepository.ts
  - src/data/repositories/HybridWeekRepository.ts
  - src/data/services/BrowserNetworkStatusService.ts
  - src/data/services/LiteLearnSyncService.ts
findings:
  critical: 9
  warning: 14
  info: 5
  total: 28
  necessity: 1
status: issues_found
---

# Post-Phase 1 Core: Code Review Report

**Reviewed:** 2026-11-24T01:48:00Z
**Depth:** standard
**Files Reviewed:** 51
**Status:** issues_found

## Summary

Reviewed all 51 core files changed since commit `c4816da`, covering NIM authentication migrations and RLS hardening (`002_nim_auth.sql`, `003_sync_and_rls_hardening.sql`), Vercel/Vite PWA configuration, DI composition (`src/app/di.ts`), domain rules/contracts, application use cases, IndexedDB schema/seeding, Supabase remote adapter, hybrid repositories, network probing, and the offline delta-sync engine.

- **Clean Architecture boundaries:** Verified clean. `src/domain/` and `src/application/` contain zero React, Dexie, Supabase, or browser-global imports.
- **Critical blockers (9):** Significant defects were found in security and offline data integrity:
  1. **Stored XSS via offline PDF `blob:` URLs** when a captive portal or untrusted response returns `text/html`/`image/svg+xml` (`CR-01`).
  2. **Deterministic duplicate local note rows & silent sync divergence** caused by local UUID vs. Postgres-generated UUID mismatch (`CR-02`).
  3. **Broken LWW & out-of-order outbox replay** that overwrites newer edits on both server and client (`CR-03`).
  4. **Delta-sync watermark (`last_sync_at`) race & clock skew** that permanently skips records updated during sync/PDF prefetch, plus lost hydration for offline-followed courses (`CR-04`).
  5. **Cross-user `syncQueue` poisoning & leakage** across default sign-out (`CR-05`).
  6. **Broken remote `SignUp` flow** that orphans accounts on invalid class codes and leaves valid sign-ups with `currentClass: null` and empty courses (`CR-06`).
  7. **SQL security gaps in `003_sync_and_rls_hardening.sql`**: `SECURITY DEFINER` function `public.material_class_id` is executable by `PUBLIC`/`anon`, and `handle_new_auth_user` permits NIM squatting via raw auth metadata (`CR-07`).
  8. **Destructive `LiteLearnDb.open()`** wipes all unsynced user data on `VersionError`/`UpgradeError` (`CR-08`).
  9. **Material attachment corruption** across offline/online edits (silent dangling storage pointers, self-deletion of replacement PDFs, and stale cached blobs) (`CR-09`).
- **Warnings (14, including 1 necessity finding) & Info (5):** Cover missing CSP/HSTS headers, unsalted single-round SHA-256 local password hashing, unverified upload byte lengths/magic bytes, permanently cached failed Supabase chunk imports, iOS Safari `"Load failed"` offline-fallback gap, queue poison pills, error-code misclassification, incomplete `initPromise` gating, soft-delete leaks in search/offline overview, network probe bugs, timestamp corruption on local PDF caching, toggle/sign-out atomicity, class-switch cleanup gaps, and dead code.

## Narrative Findings (AI reviewer)

All findings below were verified directly against the current repository source files and cross-checked with calling layers and migration `001_initial_schema.sql`.

## Critical Issues

### CR-01: Stored XSS and Captive-Portal Corruption via Unvalidated Downloaded PDF MIME Type and Bytes

**Classification:** BLOCKER
**File:** `src/data/repositories/HybridMaterialRepository.ts:327-341`, `src/data/repositories/HybridMaterialRepository.ts:377-430`, `src/application/usecases/content/DownloadMaterialFile.ts:45-60`, `src/data/services/LiteLearnSyncService.ts:431-438`
**Issue:** `HybridMaterialRepository.downloadRemoteFile` trusts the HTTP `Content-Type` header returned by `fetch(signedUrl)` verbatim (`response.headers.get('content-type') || 'application/pdf'`, line 340) without checking that the response is actually a PDF (`application/pdf` content type and `%PDF-` magic header). `DownloadMaterialFile` (line 59), `LiteLearnSyncService.prefetchSmallFollowedPdfs` (line 437), and `HybridMaterialRepository.saveOfflineFile` (line 403) persist this untrusted `mimeType` into IndexedDB `materialBlobs`, and `getOfflineFile` (line 427) returns it directly to the UI. All three UI callers (`src/presentation/pages/MaterialDetailPage.tsx:108-112`, `CourseDetailPage.tsx:108-112`, `HomePage.tsx:149-153`) construct `new Blob([bytesCopy], { type: stored.mimeType || 'application/pdf' })` and open `URL.createObjectURL(pdfBlob)` in a new tab. Because `blob:` URLs inherit the application's origin, a dorm Wi-Fi captive portal or MitM/misconfigured storage response returning HTTP 200 `text/html` or `image/svg+xml` gets cached as an offline PDF and executes arbitrary JavaScript in LiteLearn's origin — exposing `localStorage` (Supabase JWT/refresh token) and IndexedDB (private notes and local credentials).
**Fix:** Validate both HTTP `Content-Type` and `%PDF-` magic bytes before accepting downloaded bytes, and always force `'application/pdf'` when storing and serving offline PDFs:
```ts
function hasPdfMagicHeader(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d    // -
  );
}

// In HybridMaterialRepository.downloadRemoteFile:
const rawContentType = (response.headers.get('content-type') ?? '')
  .split(';')[0]
  ?.trim()
  .toLowerCase();
const bytes = new Uint8Array(await response.arrayBuffer());
if (
  (rawContentType && rawContentType !== 'application/pdf' && rawContentType !== 'application/octet-stream') ||
  !hasPdfMagicHeader(bytes)
) {
  throw new AppError(
    'INVALID_FILE_TYPE',
    'Downloaded response was not a valid PDF document.',
  );
}
return { bytes, mimeType: 'application/pdf' };

// In saveOfflineFile and getOfflineFile: always enforce 'application/pdf'.
```

### CR-02: Duplicate Local Note Rows and Invisible Remote Edits Due to Local vs. Remote UUID Mismatch

**Classification:** BLOCKER
**File:** `src/data/remote/SupabaseRemoteDataSource.ts:813-832`, `src/data/services/LiteLearnSyncService.ts:193-196`, `src/data/services/LiteLearnSyncService.ts:274-320`, `src/data/repositories/HybridAuthRepository.ts:395-397`, `src/data/local/LiteLearnDb.ts:190`
**Issue:** When a student creates a note locally, `DexieNoteRepository.upsert` generates a local UUID primary key (`id = UUID_LOCAL`). However, `SupabaseRemoteDataSource.upsertNote` omits `id` from the upsert payload (`lines 818-827`) and resolves conflicts via `onConflict: 'user_id,material_id'`, causing Postgres to generate a *different* primary key (`id = UUID_REMOTE`) and stamp `updated_at = now()` (strictly later than the local note's `updatedAt`). Immediately afterward inside the same `syncNow()` call (`LiteLearnSyncService.ts:193-196`), `fetchUserNotes` returns that note with `id = UUID_REMOTE`, and `mergeRemoteNotesSafely` runs `this.db.notes.bulkPut(...)` (line 318). Because Dexie's `notes` table is keyed by `id` and `[userId+materialId]` is non-unique (`LiteLearnDb.ts:190`), `bulkPut` inserts a **second duplicate row** for the same `(userId, materialId)` instead of replacing the local row. The same duplication happens in `HybridAuthRepository.signIn` (line 396). Because `DexieNoteRepository` reads/updates via `.where('[userId+materialId]').equals([userId, materialId]).first()`, whichever UUID sorts lexicographically first wins permanently: if `UUID_LOCAL < UUID_REMOTE`, every subsequent remote update from another device writes to `UUID_REMOTE` while the UI keeps reading the stale `UUID_LOCAL` row forever.
**Fix:** Reconcile by `[userId+materialId]` inside a Dexie transaction when applying remote notes (replacing any local row with a differing `id`), and optionally send the client's `id` on initial insert:
```ts
// In LiteLearnSyncService.mergeRemoteNotesSafely (and HybridAuthRepository.signIn):
await this.db.transaction('rw', this.db.notes, async () => {
  for (const remoteNote of safeToApply) {
    const existing = await this.db.notes
      .where('[userId+materialId]')
      .equals([remoteNote.userId, remoteNote.materialId])
      .toArray();
    const staleIds = existing
      .map((row) => row.id)
      .filter((id) => id !== remoteNote.id);
    if (staleIds.length > 0) {
      await this.db.notes.bulkDelete(staleIds);
    }
    await this.db.notes.put(domainNoteToLocal(remoteNote));
  }
});
```

### CR-03: Broken LWW Conflict Resolution and Out-of-Order Outbox Replay Silently Overwrite Newer Edits

**Classification:** BLOCKER
**File:** `src/data/remote/SupabaseRemoteDataSource.ts:813-832`, `src/data/services/LiteLearnSyncService.ts:113-129`, `src/data/services/LiteLearnSyncService.ts:135-190`, `src/data/services/LiteLearnSyncService.ts:219-272`, `src/application/usecases/notes/SaveMaterialNote.ts:32-37`, `src/data/repositories/DexieSyncQueueRepository.ts:38-52`
**Issue:** Three compounding flaws break Last-Write-Wins (LWW) and cause silent data loss:
1. **Stale offline note clobbers newer remote note:** `SupabaseRemoteDataSource.upsertNote` discards the queued note's `updatedAt` and always writes `updated_at: new Date().toISOString()` (`line 823`). An offline edit made at 10:00 on Device A that syncs at 10:10 unconditionally overwrites Device B's 10:05 edit on Supabase and stamps it 10:10, destroying Device B's work on all devices.
2. **Non-coalesced outbox replays older edits after newer edits:** `DexieSyncQueueRepository.enqueue` (used by `SaveMaterialNote`) and all 5 `Hybrid*Repository` `create`/`update` methods append a new `syncQueue` row on every edit without coalescing existing pending items for the same `(entityType, entityId)` (unlike `HybridCourseRepository.followCourse`, lines 162-169). If Edit v1 fails and receives a future `nextRetryAt`, Edit v2 (`nextRetryAt: null`) is pushed first and removed; once v1's backoff expires, v1 replays and overwrites v2 on the server with older content.
3. **Unconditional delta pull clobbers pending/backed-off local edits:** Unlike `mergeRemoteNotesSafely`, `LiteLearnSyncService.syncNow` (line 142) and `applyHydratedContent` (lines 242, 251, 261, 266) unconditionally `bulkPut` remote courses, weeks, materials, deadlines, and announcements into Dexie without checking pending `syncQueue` items or comparing `updatedAt`. Any rep edit still queued/backed-off in `syncQueue` is immediately overwritten locally during pull.
**Fix:**
1. Coalesce `syncQueue` writes by `(entityType, entityId)` inside a single transaction (deleting superseded pending entries for the same entity before inserting the latest state, preserving `hasPendingBlob` if an earlier queued entry had an unuploaded blob).
2. Send client `updatedAt` on `upsertNote` (and guard server-side via RPC/conditional update `WHERE notes.updated_at <= excluded.updated_at` so stale offline writes cannot overwrite newer server rows).
3. In `syncNow` / `applyHydratedContent`, skip overwriting any local course/week/material/deadline/announcement that still has a pending `syncQueue` entry or a strictly newer local `updatedAt`.

### CR-04: Delta Sync Watermark (`last_sync_at`) Permanently Misses Records and Drops Hydration for Newly Followed Courses

**Classification:** BLOCKER
**File:** `src/data/services/LiteLearnSyncService.ts:110-208`
**Issue:**
1. **Post-pull client clock watermark skips concurrent & skewed updates:** `LiteLearnSyncService.syncNow` sets `LAST_SYNC_META_KEY` to the **client's** `new Date().toISOString()` (`lines 204-207`) *after* all delta pulls AND *after* `prefetchSmallFollowedPdfs(userId)` (`line 200`), which can run for 15-60+ seconds over slow dorm Wi-Fi. Any course, material, deadline, announcement, or note written to Supabase during that window (or whenever the client device clock is ahead of Postgres `now()`) has `updated_at <= sinceIso` and is **permanently skipped** by subsequent `gt('updated_at', sinceIso)` queries.
2. **Mid-sync failure permanently drops initial hydration for offline-followed courses:** `newlyFollowedCourseIds` (`line 110`) lives only in memory and is populated as `course_follow` queue items are pushed and deleted (`line 116`). If the subsequent `fetchFollowedCoursesContent` call (`line 159`) fails due to a dropped connection, the queue item is already gone; on the next sync, the course falls into `incrementalIds` (`gt('updated_at', sinceIso)`) and all pre-existing weeks, materials, deadlines, and announcements created before `sinceIso` are permanently missing.
3. **Missing remote pull for `course_follows`, `classes`, and `profiles`:** `syncNow` never calls `fetchCourseFollowsByUserId`, `fetchClassById`, or `fetchProfileById`, so courses followed/unfollowed on another device and role/class updates never propagate during sync.
**Fix:**
- Advance the delta cursor using the maximum server `updated_at` timestamp returned by Supabase (or a server timestamp fetched *before* the pull with a small overlap window and `gte`), never client wall-clock time after PDF prefetching.
- Persist a `coursesNeedingFullHydration` set in `db.meta` (or per-course sync cursors) and only remove a course from it *after* `applyHydratedContent` commits.
- Pull `fetchCourseFollowsByUserId` (skipping courses with pending local `course_follow` queue items) and `fetchClassById`/`fetchProfileById` during `syncNow`.

### CR-05: Unscoped `syncQueue` and `last_sync_at` Across Default `signOut()` Poison Sync and Leak Cross-User State

**Classification:** BLOCKER
**File:** `src/data/repositories/HybridAuthRepository.ts:428-459`, `src/data/services/LiteLearnSyncService.ts:23`, `src/data/services/LiteLearnSyncService.ts:89-129`, `src/data/services/LiteLearnSyncService.ts:322-371`, `src/data/local/LiteLearnDb.ts:129-139`
**Issue:** Default `signOut()` (`clearLocalData` omitted or `false`, which is the default in `SettingsPage.tsx:120`) only deletes `db.sessions('current')` (`line 436`). It leaves User A's `syncQueue`, `meta.last_sync_at`, `notes`, `materials`, `materialBlobs`, and `deadlineCompletions` intact in IndexedDB. Neither `LocalSyncQueueRow` nor `LAST_SYNC_META_KEY` is scoped to a `userId`. When User B signs in on the same shared browser/device and runs `syncNow(userB)`:
- `listPending` returns User A's queued mutations and `pushQueueItem` pushes them under **User B's Supabase JWT**.
- For User A's private notes, Postgres RLS rejects them with `42501`, permanently leaving `hasFailedChanges: true` and `this.lastError` set for User B (which also prevents `last_sync_at` from ever advancing at line 203).
- If User B is a class rep in the same class, User A's queued rep/course mutations execute under User B's privileges.
- `LAST_SYNC_META_KEY` carries over User A's timestamp into User B's delta pulls.
**Fix:** Scope `LAST_SYNC_META_KEY` by user (`last_sync_at:${userId}`), add `userId` to `LocalSyncQueueRow` (filtering `listPending`/`countPending`/`getSyncState` by the active `userId`), and on `signOut` clear user-scoped local caches (or explicitly partition/purge previous-user data when a different `userId` signs in).

### CR-06: Remote `SignUp` Orphans Accounts on Invalid Class Code and Leaves Valid Sign-Ups Without Local Class or Courses

**Classification:** BLOCKER
**File:** `src/data/remote/SupabaseRemoteDataSource.ts:147-195`, `src/data/repositories/HybridAuthRepository.ts:186-208`
**Issue:** Two defects break remote student registration:
1. **Orphaned account & locked-out retry on class-code typo:** `SupabaseRemoteDataSource.signUp` calls `auth.signUp(...)` (`line 150`) *before* verifying the class code via `joinClassByCode(input.classCode)` (`line 175`). If the student typos the join code, `auth.users` and `public.profiles` are already committed and Supabase Auth has established an active browser session, while `joinClassByCode` throws `NOT_FOUND`. Fixing the typo and clicking Sign Up again fails with `DUPLICATE_NIM` ("This NIM is already registered"), leaving the student stuck with a `class_id = null` account. (Additionally, if email confirmation is enabled on the Supabase project, `data.session` is `null` after `auth.signUp`, causing `joinClassByCode` to fail with `28000` mapped as `NOT_FOUND`.)
2. **Valid remote sign-up never hydrates `db.classes` or `db.courses`:** `SupabaseRemoteDataSource.signUp` calls `joinClassByCode`, receives `{ currentClass, user }`, and **discards `onboarding.currentClass`** (`line 176`). `HybridAuthRepository.signUp` (`lines 198-205`) writes only `db.users` and `db.sessions`. Because `HybridClassRepository.getById` (`HybridClassRepository.ts:27-33`) reads exclusively from Dexie and `LiteLearnSyncService.syncNow` never fetches `classes`, `GetCurrentUser` returns `{ user, currentClass: null }` and `ListCourses` returns `[]` until the student signs out and signs back in.
**Fix:**
- Validate the join code before creating the auth account (e.g., via a dedicated pre-check RPC or an Edge Function/atomic onboarding flow), or if `joinClassByCode` fails after signup, surface a recovery state that lets the already-authenticated user re-enter only the class code via `JoinClass` instead of failing as `DUPLICATE_NIM`.
- Return `{ user, currentClass }` from remote `signUp` (or fetch `fetchClassById` and `fetchCoursesByClassId` in `HybridAuthRepository.signUp`) and persist `db.classes` and `db.courses` in the same Dexie transaction as `db.users` and `db.sessions`.

### CR-07: SQL Security Defects in Migration 003: Unrevoked `SECURITY DEFINER` Oracle (`material_class_id`) and Unvalidated NIM Squatting

**Classification:** BLOCKER
**File:** `supabase/migrations/003_sync_and_rls_hardening.sql:4-15`, `supabase/migrations/003_sync_and_rls_hardening.sql:40-71`, `supabase/migrations/002_nim_auth.sql:3-27`
**Issue:**
1. **Cross-tenant IDOR / enumeration oracle exposed to `PUBLIC` (`anon`):** `public.material_class_id(target_material_id uuid)` (`003:4-15`) is declared `SECURITY DEFINER` in the PostgREST-exposed `public` schema without `REVOKE ALL ON FUNCTION ... FROM PUBLIC`. By default in PostgreSQL/Supabase, `PUBLIC` (including unauthenticated `anon` and authenticated users from other classes) can invoke `POST /rest/v1/rpc/material_class_id` with any material UUID and read back its owning `class_id`, bypassing RLS on `materials` and `courses`.
2. **NIM squatting / spoofing via direct Auth signup:** `handle_new_auth_user()` (`003:56-63`) trusts client-controlled `new.raw_user_meta_data ->> 'nim'` ahead of `new.email` without validating IT Del NIM format (`^[0-9]{2}[A-Z][0-9]{5}$`) or asserting consistency with the `@nim.litelearn.local` email local-part, and `public.profiles.nim` has no `CHECK` constraint (`002:3-27`). An attacker calling Supabase's public `/auth/v1/signup` endpoint with `email: "attacker@example.com"` and `data: { nim: "11S22001" }` claims `11S22001` in `public.profiles`, permanently blocking the real student from registering due to `profiles_nim_unique`.
**Fix:** Create a follow-up migration (`004_*.sql`) that:
```sql
-- 1. Move/remove public RPC exposure: inline RLS check using invoker permissions (or put helper in a non-exposed private schema)
revoke all on function public.material_class_id(uuid) from public;
revoke all on function public.material_class_id(uuid) from anon, authenticated;

drop policy if exists notes_insert_own on public.notes;
create policy notes_insert_own on public.notes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.materials m
      join public.courses c on c.id = m.course_id
      where m.id = material_id
        and c.class_id = public.current_user_class_id()
    )
  );

-- Apply the same EXISTS predicate to notes_update_own.

-- 2. Derive NIM authoritatively from @nim.litelearn.local email when present and enforce format constraint:
alter table public.profiles
  add constraint profiles_nim_format_check
  check (nim ~ '^[0-9]{2}[A-Z][0-9]{5}$') not valid;
```
And in `handle_new_auth_user()`, when `lower(coalesce(new.email, '')) like '%@nim.litelearn.local'`, derive `v_nim` solely from `upper(split_part(new.email, '@', 1))` and reject signups whose metadata `nim` mismatches or fails the regex.

### CR-08: Destructive `LiteLearnDb.open()` Wipes Entire IndexedDB (Including Unsynced Outbox and Private Notes) on Version/Upgrade Error

**Classification:** BLOCKER
**File:** `src/data/local/LiteLearnDb.ts:277-299`
**Issue:** `LiteLearnDb.open()` catches `UpgradeError`, `VersionError`, and `SchemaError` and immediately executes `await this.delete()` before reopening (`lines 296-297`). In an offline-first PWA, `VersionError` is routinely triggered when an older tab or stale service-worker bundle opens a database already upgraded to a newer schema version, and `UpgradeError` can fire transiently on quota or blocked-upgrade errors. Silently calling `this.delete()` irreversibly destroys all unsynced `syncQueue` edits, offline-only private `notes`, `localCredentials`, `deadlineCompletions`, and downloaded PDFs.
**Fix:** Never auto-delete the database on `VersionError` (instead prompt a page reload so the newer bundle runs) or `UpgradeError` without user consent; if recovery is ever needed, preserve/export `notes`, `syncQueue`, and `localCredentials` first or surface a blocking recovery dialog:
```ts
if (errorName === 'VersionError') {
  throw error; // Older client tab vs newer DB schema: reload rather than wipe user data.
}
```

### CR-09: Material Attachment Corruption: Dangling Storage Paths, Self-Deleted Replacement PDFs, and Stale Local Blobs

**Classification:** BLOCKER
**File:** `src/data/services/LiteLearnSyncService.ts:244-259`, `src/data/services/LiteLearnSyncService.ts:373-410`, `src/data/remote/SupabaseRemoteDataSource.ts:563-627`, `src/data/remote/SupabaseRemoteDataSource.ts:897-925`, `src/data/repositories/HybridMaterialRepository.ts:192-207`, `src/data/repositories/HybridMaterialRepository.ts:432-483`
**Issue:** Four concrete failure modes corrupt material PDF attachments and offline cache state:
1. **Silent dangling storage pointer:** `removeOfflineFile` (`line 448`) and `clearAllOfflineFiles` (`line 473`) delete rows from `db.materialBlobs` without checking whether a queued `syncQueue` item has `hasPendingBlob: true`. When `syncNow()` runs (`LiteLearnSyncService.ts:384-403`), `blobRow` is `undefined`, so the upload is **silently skipped** and `upsertMaterialPayload` writes `attachment_storage_path` pointing to a non-existent object in Supabase Storage (404 for every student).
2. **Replacing an attachment offline deletes the new upload and nulls DB columns:** When an offline update sets both `removeAttachment: true` and a new `file`:
   - `LiteLearnSyncService.ts:386` uploads the new file, and if the sanitized filename matches `previousStoragePath`, line 406 immediately calls `deleteMaterialPdf(previousStoragePath)` — **deleting the newly uploaded file**.
   - `SupabaseRemoteDataSource.upsertMaterialPayload` (`lines 909-919`) evaluates `if (payload.removeAttachment === true)` *before* `else if (payload.attachmentStoragePath)`, nulling out the newly uploaded attachment metadata on Supabase (diverging from local state and online `updateMaterial`).
3. **Online `updateMaterial` leaves stale cached blobs and orphaned storage objects:** `SupabaseRemoteDataSource.updateMaterial` (`line 625`) returns `isAvailableOffline: params.existing.isAvailableOffline` even when `removeAttachment: true` or a new `file` replaces the PDF, never calls `deleteMaterialPdf` on removed/replaced attachments, and `HybridMaterialRepository.update` (`line 200`) never deletes or refreshes `this.db.materialBlobs`.
4. **Delta pull never invalidates replaced/removed/deleted PDF blobs:** `applyHydratedContent` (`LiteLearnSyncService.ts:245-258`), `HybridAuthRepository.signIn` (`lines 364-380`), and `HybridCourseRepository.followCourse` (`lines 100-113`) only check `cachedBlobIds.has(material.id)`. If a rep replaces a PDF, removes an attachment, or soft-deletes a material, old blobs remain in `materialBlobs` (serving stale PDFs and inflating storage stats) and `isAvailableOffline` stays `true` even when `attachment === null`.
**Fix:**
- Protect blobs referenced by pending `hasPendingBlob` queue items from `removeOfflineFile` / `clearAllOfflineFiles` (or throw a clear `VALIDATION_ERROR` / mark sync item failed if `blobRow` is missing rather than silently upserting a dangling path).
- In `pushQueueItem`, delete `previousStoragePath` *only* when `previousStoragePath !== payload.attachmentStoragePath`, and in `upsertMaterialPayload`, check `payload.attachmentStoragePath` before `payload.removeAttachment === true`.
- In `HybridMaterialRepository.update` (online path), update/delete `materialBlobs` and recompute `isAvailableOffline`, and call `deleteMaterialPdf` after DB update succeeds.
- On remote material merge (`applyHydratedContent`, `signIn`, `followCourse`), compare incoming `attachment?.storagePath` and `updatedAt` against the existing local material row; delete `materialBlobs` and set `isAvailableOffline: false` whenever `material.deletedAt !== null`, `material.attachment === null`, or `attachment.storagePath` / `updatedAt` changed.

---

## Warnings

### WR-01: Missing `Content-Security-Policy` and `Strict-Transport-Security` Headers in `vercel.json`

**Classification:** WARNING
**File:** `vercel.json:8-17`
**Issue:** While `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` are configured, neither `Content-Security-Policy` (CSP) nor `Strict-Transport-Security` (HSTS) is set. Because the app stores Supabase auth tokens in `localStorage` and private student data in IndexedDB — and targets dormitory Wi-Fi networks — missing CSP leaves any XSS or `blob:` execution unrestricted, and missing HSTS leaves initial HTTP navigations vulnerable to SSL stripping.
**Fix:** Add `Strict-Transport-Security` and a restrictive `Content-Security-Policy` header to the `/(.*)` rule in `vercel.json`:
```json
{ "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co; img-src 'self' data: blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"
}
```

### WR-02: Unsalted Single-Round SHA-256 Used for Local Fallback Password Hashing

**Classification:** WARNING
**File:** `src/data/repositories/HybridAuthRepository.ts:151-164`, `src/data/local/seed.ts:47-50`, `src/data/local/seed.ts:69-72`
**Issue:** `hashLocalPassword` computes a single-round SHA-256 digest of `litelearn:${nim}:${password}` using only the public, predictable NIM as salt and zero key-stretching. Real user passwords created in local fallback mode are persisted in IndexedDB `localCredentials` and can be brute-forced at high speed if IndexedDB is accessed on a shared device or via XSS.
**Fix:** Store a random per-user 16-byte salt alongside the hash in `LocalCredentialRow` and derive keys with PBKDF2-HMAC-SHA256 (`>= 100,000` iterations via `crypto.subtle.deriveBits`, with a pure-JS PBKDF2-HMAC-SHA256 fallback for plain HTTP LAN origins).

### WR-03: `validateMaterialFile` Trusts Declared `sizeBytes`, Permits Empty MIME Without Magic-Byte Check, and Edge Cases in Path Sanitization

**Classification:** WARNING
**File:** `src/domain/rules/fileRules.ts:20-43`, `src/data/remote/SupabaseRemoteDataSource.ts:75-96`, `src/data/remote/SupabaseRemoteDataSource.ts:459-477`
**Issue:**
1. `validateMaterialFile` only inspects `file.sizeBytes` metadata and never validates actual `file.bytes.byteLength`. A caller passing `{ sizeBytes: 100, bytes: new Uint8Array(10_000_000) }` or empty bytes bypasses both empty-file and 5 MB checks before upload.
2. `validateMaterialFile` accepts `mimeType === ''` without checking `%PDF-` magic header bytes, allowing non-PDF files renamed `.pdf` to be uploaded with forced `contentType: 'application/pdf'`.
3. A filename like `a/.pdf` passes `trimmedName.length > 4 && endsWith('.pdf')`, after which `sanitizeStorageFileName` strips `a/` and returns stemless `.pdf`. Likewise, `sanitizePathSegment('.')` accepts `"."`.
**Fix:** Validate `bytes.byteLength` against `1..MAX_MATERIAL_FILE_BYTES`, check the `%PDF-` header bytes on upload, reject `"."` and `".."` in `sanitizePathSegment`, and validate the base filename stem *after* stripping path separators.

### WR-04: Permanently Cached Rejected Promise in `createLazySupabaseClientLoader`

**Classification:** WARNING
**File:** `src/data/remote/supabaseClient.ts:29-46`
**Issue:** `clientPromise` is memoized on first call (`lines 34-44`) with no `.catch` reset. If `import('@supabase/supabase-js')` fails once (e.g., offline startup before SW precache completes, transient dorm Wi-Fi drop, or chunk fetch error), `clientPromise` stays permanently rejected and breaks every subsequent remote request until a hard page reload.
**Fix:** Reset `clientPromise` on failure:
```ts
if (!clientPromise) {
  clientPromise = import('@supabase/supabase-js')
    .then(({ createClient }) =>
      createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      }),
    )
    .catch((err) => {
      clientPromise = null;
      throw err;
    });
}
```

### WR-05: Duplicated `isNetworkFailure` Misses iOS Safari (`"Load failed"`) & `AbortError`, and Non-Idempotent `create*` Retries Can Duplicate Rows

**Classification:** WARNING
**File:** `src/data/repositories/HybridAnnouncementRepository.ts:16-28`, `src/data/repositories/HybridCourseRepository.ts:24-38`, `src/data/repositories/HybridDeadlineRepository.ts:16-28`, `src/data/repositories/HybridMaterialRepository.ts:22-34`, `src/data/repositories/HybridWeekRepository.ts:13-25`, `src/data/remote/SupabaseRemoteDataSource.ts:366-382`
**Issue:**
1. The copy-pasted `isNetworkFailure` helper checks for `'failed to fetch'`, `'network'`, `'timeout'`, and `'offline'`, but omits Safari/iOS WebKit's `TypeError: Load failed` and `AbortError`. On iOS devices connected to broken dorm Wi-Fi (`navigator.onLine === true`), rep writes fail instead of queueing offline.
2. Matching substrings on any error can misclassify non-network `AppError`s (e.g., `VALIDATION_ERROR` / `FORBIDDEN_ROLE` whose message contains `"network"` or `"offline"`) as network failures and queue invalid mutations.
3. `createCourse`, `createWeek`, `createDeadline`, and `createAnnouncement` (`SupabaseRemoteDataSource.ts:366, 411, 629, 676`) omit a client-generated `id` on `.insert(...)` (unlike `createMaterial`). If Postgres commits the row but the HTTP response times out, offline fallback generates a new UUID and queues an upsert — creating duplicate rows (or permanent `23505` collisions on `weeks(course_id, week_number)`) on sync.
**Fix:** Extract a single shared `isNetworkFailure` utility that immediately returns `false` for non-`STORAGE_ERROR` `AppError`s and recognizes `'load failed'` and `AbortError`. Pass a pre-generated UUID `id` on initial remote `insert` for courses, weeks, deadlines, and announcements so offline fallback retries are idempotent upserts.

### WR-06: Outbox Sync Loop Ignores Entity Dependency Order and Retries Poison-Pill Failures Forever

**Classification:** WARNING
**File:** `src/data/services/LiteLearnSyncService.ts:113-129`, `src/data/services/LiteLearnSyncService.ts:203-208`
**Issue:**
1. When a rep creates a Course, Week, and Material offline and the `course` push fails transiently, the `for (const item of pendingItems)` loop continues pushing the dependent `week` and `material` items, causing Postgres FK violations (`23503`) and desynchronizing their retry backoff schedules so child items can retry before their parent.
2. Permanent errors (`42501` RLS denial after a student switches classes, `23505` unique conflict, `22P02` invalid syntax, or corrupt `JSON.parse` payload) are retried indefinitely with no max-attempt limit or quarantine state. Each retry sets `this.lastError`, keeping `hasFailedChanges: true` permanently and preventing `LAST_SYNC_META_KEY` from updating at line 203.
**Fix:** Track failed parent IDs (`course`, `week`) during a sync pass and defer dependent child items without incrementing their failure attempts; classify terminal errors (`FORBIDDEN_ROLE`, `VALIDATION_ERROR`, `JSON.parse` failure, or attempts exceeding a max cap such as 5) into a quarantined state so they do not block delta sync cursor updates forever.

### WR-07: Misclassified Remote Error Codes (`23505`, `28000`) and `SignIn` Masking Network/Storage Outages as Wrong Password

**Classification:** WARNING
**File:** `src/data/remote/SupabaseRemoteDataSource.ts:118-129`, `src/data/remote/SupabaseRemoteDataSource.ts:205-213`, `src/application/usecases/auth/SignIn.ts:22-39`
**Issue:**
1. `mapRemoteError` maps *every* Postgres `23505` unique violation to `DUPLICATE_JOIN_CODE` (`line 118-120`), misclassifying duplicate week numbers (`weeks_course_id_week_number_key`) and duplicate NIMs (`profiles_nim_unique`). It also fails to map `28000` (raised by `join_class_by_code` / `create_class_as_rep` when unauthenticated) to `AUTH_ERROR`, causing `joinClassByCode` (`line 291`) to misreport unauthenticated errors as `NOT_FOUND`.
2. `SupabaseRemoteDataSource.signIn` (`lines 205-212`) converts *all* Supabase errors — including network failures (`AuthRetryableFetchError`), 5xx outages, 429 rate limits, and missing profile rows after successful authentication — into `'NIM or password is incorrect.'`. Likewise, `SignIn.ts:35-38` catches all non-`AppError` exceptions (e.g., network/IndexedDB failures) and replaces them with `'NIM or password is incorrect.'`.
3. `SignIn.ts:24` throws `VALIDATION_ERROR` for invalid NIM format instead of `INVALID_NIM_FORMAT` (inconsistent with `SignUp.ts:24`).
**Fix:** Map `28000` to `AUTH_ERROR` and inspect error message/constraint name (or accept a `duplicateCode` parameter) for `23505`. In `SupabaseRemoteDataSource.signIn` and `SignIn.ts`, only return `'NIM or password is incorrect.'` for actual credential rejection errors; surface network/5xx/storage failures as `STORAGE_ERROR` or `AUTH_ERROR` with a connectivity message, and throw `INVALID_NIM_FORMAT` on line 24 of `SignIn.ts`.

### WR-08: Incomplete `initPromise` Seeding Guards in `di.ts` and Local Demo Seeder Resurrecting Unfollowed Courses

**Classification:** WARNING
**File:** `src/app/di.ts:197-339`, `src/data/local/seed.ts:84-108`, `src/data/local/seed.ts:265-338`
**Issue:**
1. Only 7 of 33 use cases in `di.ts` await `initPromise` (`seedInitialLocalDemo(db)`). Direct deep links or early calls to `GetCurrentUser`, `GetMaterial`, `ListAnnouncements`, `DownloadMaterialFile`, or `SignUp` race against local seeding (e.g., cold-loading a material URL returns `NOT_FOUND`, and signing up with `CLASSA` races with `seedInitialLocalDemo`). Additionally, if `seedInitialLocalDemo` rejects once, `initPromise` stays permanently rejected and breaks all 7 wrapped use cases.
2. `seedInitialLocalDemo` (`seed.ts:85-107`) executes on every reload in local fallback mode and automatically re-follows `seed-course-a` and `seed-course-b` for *any* Class A user with zero follows — undoing a user's deliberate unfollow of all courses. Similarly, `seedSampleClassData` (`seed.ts:279, 315, 333`) resets `isAvailableOffline: false` on seeded materials even if their blobs already exist in `db.materialBlobs`.
**Fix:** Persist a one-time `local_demo_seeded_v1` flag in `db.meta` so `seedInitialLocalDemo` runs only once (never resurrecting unfollowed courses), guard `initPromise` against caching rejections, await initialization in `GetCurrentUser`/`GetMaterial`/`ListAnnouncements`/`SignUp` (or via a single DB-ready hook), and preserve existing `materialBlobs` status in `seedSampleClassData`.

### WR-09: Soft-Deleted Week Content Leaks into Search and Offline Overview, Missing Follow Deduplication, and Soft-Deleted Offline Blobs Still Served

**Classification:** WARNING
**File:** `src/application/usecases/search/SearchWorkspace.ts:77`, `src/application/usecases/search/SearchWorkspace.ts:114-139`, `src/application/usecases/content/GetOfflineStudyOverview.ts:44-51`, `src/application/usecases/content/GetOfflineStudyOverview.ts:65-75`, `src/data/repositories/HybridMaterialRepository.ts:413-430`
**Issue:**
1. `SearchWorkspace` (`lines 114-139`) returns materials whose parent week is soft-deleted (`weekById.get(material.weekId)` is `undefined`), producing clickable hits that fail with `NOT_FOUND` in `GetMaterial` (`GetMaterial.ts:35-36`). `GetOfflineStudyOverview` (`lines 66-75`) similarly counts materials and PDFs belonging to soft-deleted weeks.
2. Neither `SearchWorkspace` (`line 77`) nor `GetOfflineStudyOverview` (`line 46`) deduplicates `followedCourseIds` (unlike `GetUpcomingDeadlines.ts:42`), risking duplicate search hits and double-counted overview totals if duplicate follow rows exist locally.
3. `HybridMaterialRepository.getOfflineFile` (`lines 419-429`) serves a cached blob even when `materialRow` is missing or soft-deleted (`materialRow.deletedAt !== null`).
**Fix:** Require `weekById.has(material.weekId)` in `SearchWorkspace` and `GetOfflineStudyOverview`, deduplicate `followedCourseIds` via `Array.from(new Set(...))`, and return `null` from `getOfflineFile` when `!materialRow || materialRow.deletedAt !== null`.

### WR-10: `BrowserNetworkStatusService` Ignores `VITE_SUPABASE_URL`, Triggers CORS Failures on Raw Supabase Root Probes, and Races with `offline` Events

**Classification:** WARNING
**File:** `src/app/di.ts:187-189`, `src/data/services/BrowserNetworkStatusService.ts:57-102`, `src/data/services/BrowserNetworkStatusService.ts:127-132`
**Issue:**
1. `di.ts:188` passes `probeUrl: options.supabaseUrl?.trim() || null` rather than `supabaseConfig?.url`, so env-configured deployments ignore `VITE_SUPABASE_URL`. Conversely, when `options.supabaseUrl` *is* supplied as a raw Supabase base URL (`https://<ref>.supabase.co`), `HEAD https://<ref>.supabase.co/?_ping=...` fails CORS/404 and enters `catch` (`line 94`), misreporting a healthy connection as `'slow'` on every 30-second interval.
2. `probeNow()` has no in-flight deduplication or cancellation. If `handleOffline` emits `'offline'` while an earlier `probeNow()` request is still in flight, the resolving or rejecting probe can overwrite `'offline'` with `'online'` or `'slow'`.
**Fix:** Use a same-origin uncached probe path (excluded from Workbox precache) or a CORS-enabled health endpoint, track an active `AbortController`/sequence counter in `BrowserNetworkStatusService`, abort active probes inside `handleOffline`, and discard results from superseded probe generations.

### WR-11: Local Offline PDF Caching Corrupts Material Domain `updatedAt` Timestamps

**Classification:** WARNING
**File:** `src/data/repositories/HybridMaterialRepository.ts:388-394`, `src/data/repositories/HybridMaterialRepository.ts:438-442`
**Issue:** Both `saveOfflineFile` (`line 393`) and `removeOfflineFile` (`line 441`) overwrite `LocalMaterialRow.updatedAt` with `new Date().toISOString()`. Downloading or evicting a local offline PDF copy is device-local cache state, not a content modification; mutating `updatedAt` falsifies the material's modification timestamp and will break any LWW timestamp comparison against remote material updates.
**Fix:** Preserve `existingRow.updatedAt` in `saveOfflineFile` and `removeOfflineFile`; store the local download timestamp exclusively in `materialBlobs.savedAt`.

### WR-12: Non-Atomic Read-Modify-Write Race in `ToggleDeadlineCompletion` and Non-Transactional Multi-Table Wipe in `HybridAuthRepository.signOut`

**Classification:** WARNING
**File:** `src/application/usecases/deadlines/ToggleDeadlineCompletion.ts:34-41`, `src/data/repositories/HybridAuthRepository.ts:438-458`
**Issue:**
1. When `input.completed` is omitted, `ToggleDeadlineCompletion` performs a separate read (`listCompletedDeadlineIds`) followed by a write (`setDeadlineCompleted`) outside a transaction. Rapid double-taps read the same initial state and overwrite each other instead of toggling cleanly.
2. `HybridAuthRepository.signOut({ clearLocalData: true })` runs 15 independent `.clear()` calls via `Promise.all` outside a Dexie transaction; if the tab closes or one table fails midway, local storage is left half-cleared.
**Fix:** Add an atomic `toggleDeadlineCompleted(userId, deadlineId)` method using a Dexie `'rw'` transaction in `DexieDeadlineCompletionRepository`, and wrap all 15 `.clear()` calls in `signOut` inside a single `this.db.transaction('rw', [...], ...)`.

### WR-13: Class-Switching Gaps in Migration `003`: Stale `course_follows` After `join_class_by_code` and Missing Rep-Orphan Guard in `create_class_as_rep`

**Classification:** WARNING
**File:** `supabase/migrations/003_sync_and_rls_hardening.sql:74-135`
**Issue:**
1. When a student uses `join_class_by_code` to switch from Class A to Class B, `profiles.class_id` is updated (`lines 119-128`), but existing `public.course_follows` rows referencing Class A's courses are not deleted. Those orphaned follow rows continue to be returned by `fetchCourseFollowsByUserId` and pollute client follow counts and sync requests.
2. Migration 003 added a guard preventing an existing class rep from switching classes and orphaning their class via `join_class_by_code` (`lines 113-117`), but the parallel RPC `public.create_class_as_rep` (`001_initial_schema.sql:213-258`) still lacks this guard, allowing a rep to orphan their class by creating a new one.
**Fix:** In a follow-up migration, update `join_class_by_code` to delete `public.course_follows` rows for courses outside `v_class.id` whenever `v_existing.class_id is distinct from v_class.id`, and add the same rep-ownership guard to `create_class_as_rep`.

### WR-14: Cargo-Culted Pattern — `Object.setPrototypeOf` in `AppError` Under `ES2022` Target

**Classification:** WARNING
**File:** `src/application/errors/AppError.ts:21`
**Category:** necessity
**Issue:** `Object.setPrototypeOf(this, AppError.prototype)` is an ES5 transpilation workaround for broken `Error` subclassing. This repository targets `"target": "ES2022"` (`tsconfig.json:3`) with Vite 6 (`package.json:29`), where native ES6 `class AppError extends Error` preserves the prototype chain automatically; manually forcing `AppError.prototype` is unnecessary and would break `instanceof` if `AppError` is ever subclassed.
**Fix:** Remove `Object.setPrototypeOf(this, AppError.prototype);` from `AppError`'s constructor.

---

## Info

### IN-01: Fractional `limit` Between `0` and `1` Floors to `0` in `ListRecentAnnouncements`

**Classification:** INFO
**File:** `src/application/usecases/announcements/ListRecentAnnouncements.ts:26`
**Issue:** `const limit = input.limit && input.limit > 0 ? Math.floor(input.limit) : 5;` evaluates to `0` for fractional inputs like `0.5`, causing `.slice(0, 0)` to return `[]` unexpectedly.
**Fix:** Use `const limit = input.limit !== undefined && Number.isFinite(input.limit) && input.limit >= 1 ? Math.floor(input.limit) : 5;`.

### IN-02: Unused Domain Rule `isDueForRetry` Duplicated in `DexieSyncQueueRepository` and Missing `NaN` Guard in `calculateBackoffDelayMs`

**Classification:** INFO
**File:** `src/domain/rules/syncRules.ts:4-22`, `src/data/repositories/DexieSyncQueueRepository.ts:21-30`
**Issue:** `isDueForRetry` is exported from `src/domain/rules/syncRules.ts` but never used in production code; `DexieSyncQueueRepository.listPending` reimplements the same `nextRetryAt` comparison inline. Additionally, `calculateBackoffDelayMs(NaN)` returns `NaN` because `Math.max(0, Math.floor(NaN))` is `NaN`, which would throw `RangeError: Invalid time value` in `new Date(Date.now() + delayMs).toISOString()`.
**Fix:** Guard `Number.isFinite(attempts)` in `calculateBackoffDelayMs` (defaulting to `0`) and call `isDueForRetry(row.nextRetryAt, thresholdMs)` inside `DexieSyncQueueRepository.listPending`.

### IN-03: Dead Exports (`getSessionUserId`, `WeekIndexEntry`) and Unreconciled Remote Session in `HybridAuthRepository.getCurrentUser`

**Classification:** INFO
**File:** `src/data/remote/SupabaseRemoteDataSource.ts:223-229`, `src/application/dto/OfflineDto.ts:101`, `src/data/repositories/HybridAuthRepository.ts:172-184`
**Issue:** `SupabaseRemoteDataSource.getSessionUserId()` and `OfflineDto.WeekIndexEntry` are exported but never referenced anywhere in the codebase. Relatedly, `HybridAuthRepository.getCurrentUser()` reads only Dexie `db.sessions` without checking whether the Supabase Auth session is still present or matches when online.
**Fix:** Remove `WeekIndexEntry` (or export/use it if intended) and either remove `getSessionUserId()` or use it to detect/reconcile revoked remote sessions when online.

### IN-04: Production `HybridAuthRepository.signUp` Hardcodes Demo Seed Identifiers

**Classification:** INFO
**File:** `src/data/repositories/HybridAuthRepository.ts:216-227`, `src/data/repositories/HybridAuthRepository.ts:275-290`
**Issue:** `HybridAuthRepository.signUp` hardcodes `'CLASSA'`, `'seed-class-a'`, `'seed-course-a'`, and `'seed-course-b'` directly inside the repository implementation to auto-create the demo class and auto-follow two courses on local signup.
**Fix:** Keep demo seed constants in `src/data/local/seed.ts` and ensure local seeding completes before `SignUp` executes (see `WR-08`), avoiding demo-specific branching inside `HybridAuthRepository`.

### IN-05: Migration `002_nim_auth.sql` Backfill Fragility for Null or Colliding Email Prefixes

**Classification:** INFO
**File:** `supabase/migrations/002_nim_auth.sql:9-14`
**Issue:** `update public.profiles set nim = upper(split_part(email, '@', 1)) where nim is null and email is not null;` followed by `alter column nim set not null` and `unique (nim)` will fail on any pre-existing database containing empty-string emails or two users sharing the same local part across different email domains.
**Fix:** For future environments or fresh migrations, guard empty/duplicate backfilled values using a deterministic fallback (e.g., UUID prefix, matching `003`'s `handle_new_auth_user`) before adding `NOT NULL` and `UNIQUE`.

---

_Reviewed: 2026-11-24T01:48:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
