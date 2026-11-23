# Task Checklist: LiteLearn Frontend & Backend Hardening + UX Upgrade

See full rationale, dependency graph, and risks in [plan.md](./plan.md).

---

## Phase 1: Backend Reliability, Offline Sync & Security

### Task 1: Harden Postgres RLS, NIM trigger fallback, and Vercel security headers
**Description:** Create an idempotent SQL migration `003_sync_and_rls_hardening.sql` that restricts `notes` insert/update RLS to materials inside the caller's own class, replaces the hardcoded `'11S22001'` NIM fallback in `handle_new_auth_user()` with a collision-safe unique fallback, prevents an active class rep from silently demoting themselves via `join_class_by_code` while owning courses, and adds standard HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) to `vercel.json`.

**Acceptance criteria:**
- [x] `supabase/migrations/003_sync_and_rls_hardening.sql` is idempotent (`create or replace`, `drop policy if exists`) and enforces class membership on `notes` RLS.
- [x] `handle_new_auth_user()` never falls back to a colliding static NIM string.
- [x] `vercel.json` serves security headers on `/(.*)` without breaking PWA service worker or font loading.

**Verification:**
- [x] Tests pass: `npm test` (including `boundaries.test.ts` zero em/en-dash check on `supabase/*.sql`)
- [x] Build succeeds: `npm run build`
- [x] Manual check: Review SQL statements for syntax and reversibility

**Dependencies:** None

**Files likely touched:**
- `supabase/migrations/003_sync_and_rls_hardening.sql`
- `vercel.json`

**Estimated scope:** Small (2 files)

---

### Task 2: Fix offline material PDF upload/removal sync and fresh signed URL minting
**Description:** Fix the silent data-loss bug where materials created or updated offline fail to upload cached PDF blobs or omit `courseId` during sync, and fix `HybridMaterialRepository.downloadRemoteFile` so it always mints a fresh signed URL from `storagePath` instead of reusing expired cached URLs.

**Acceptance criteria:**
- [x] Offline material create/update queue payloads include `courseId`, `classId`, and `removeAttachment`.
- [x] `LiteLearnSyncService.pushQueueItem` uploads pending `materialBlobs` bytes to Supabase Storage before calling `upsertMaterialPayload`, and clears attachment fields when `removeAttachment` is true.
- [x] `downloadRemoteFile` requests a fresh signed URL whenever `remote !== null` and `storagePath` exists, avoiding 1-hour expiry failures.
- [x] Unit tests verify offline material create + PDF sync and `removeAttachment` sync.

**Verification:**
- [x] Tests pass: `npm test`
- [x] Typecheck passes: `npm run typecheck`
- [x] Manual check: Create material with PDF offline, reconnect, run sync, confirm blob uploads and metadata reconciles

**Dependencies:** Task 1

**Files likely touched:**
- `src/data/repositories/HybridMaterialRepository.ts`
- `src/data/remote/SupabaseRemoteDataSource.ts`
- `src/data/services/LiteLearnSyncService.ts`
- `src/tests/data/phase1SyncHardening.test.ts`

**Estimated scope:** Medium (4 files)

---

### Task 3: Add offline-first `course_follow` outbox and bidirectional private notes pull
**Description:** Make `HybridCourseRepository.followCourse` and `unfollowCourse` work seamlessly offline in remote mode by updating IndexedDB optimistically and enqueueing a `course_follow` sync operation. Add `fetchUserNotes(userId)` to `SupabaseRemoteDataSource` and pull user notes on sign-in and sync without overwriting newer unsynced local edits.

**Acceptance criteria:**
- [x] Toggling Follow offline in remote mode updates local `courseFollows` and enqueues `course_follow` (`upsert`/`delete`) without throwing.
- [x] `LiteLearnSyncService.pushQueueItem` replays `course_follow` operations against Supabase.
- [x] `fetchUserNotes(userId)` hydrates `db.notes` during `signIn` and `syncNow` while skipping notes that have a pending local `note` queue entry or newer local `updatedAt`.
- [x] Unit tests cover offline follow/unfollow queuing and conflict-safe note pull.

**Verification:**
- [x] Tests pass: `npm test`
- [x] Typecheck passes: `npm run typecheck`
- [x] Manual check: Toggle course follow offline, verify queue increments and reconciles on sync

**Dependencies:** Task 1

**Files likely touched:**
- `src/domain/entities/SyncQueueItem.ts` (if `SyncEntityType` needs `'course_follow'`)
- `src/data/repositories/HybridCourseRepository.ts`
- `src/data/remote/SupabaseRemoteDataSource.ts`
- `src/data/repositories/HybridAuthRepository.ts`
- `src/data/services/LiteLearnSyncService.ts`
- `src/tests/data/phase1SyncHardening.test.ts`

**Estimated scope:** Medium (5-6 files)

---

### Task 4: Implement true `updated_at` delta sync, remove N+1 URL signing, and guard `LiteLearnDb.open()`
**Description:** Reduce low-bandwidth sync traffic by adding an optional `sinceIso` filter (`.gt('updated_at', sinceIso)`) to `fetchCoursesByClassId` and `fetchFollowedCoursesContent`, removing eager per-material `createSignedUrl` calls during bulk sync, and narrowing `LiteLearnDb.open()` auto-reset to genuine `UpgradeError` / `VersionError` cases so transient lock errors never wipe user data.

**Acceptance criteria:**
- [x] `fetchFollowedCoursesContent` does not call `getSignedMaterialUrl` in a loop during bulk sync.
- [x] `LiteLearnSyncService.syncNow` passes `last_sync_at` for incremental delta pulls (while keeping full pull when `last_sync_at` is absent).
- [x] `LiteLearnDb.open()` only resets IndexedDB on unrecoverable schema upgrade errors and surfaces other errors safely.

**Verification:**
- [x] Tests pass: `npm test`
- [x] Typecheck passes: `npm run typecheck`
- [x] Manual check: Inspect network requests on sync; confirm zero N+1 signed-URL requests

**Dependencies:** Task 2, Task 3

**Files likely touched:**
- `src/data/remote/SupabaseRemoteDataSource.ts`
- `src/data/services/LiteLearnSyncService.ts`
- `src/data/local/LiteLearnDb.ts`
- `src/tests/data/phase1SyncHardening.test.ts`

**Estimated scope:** Medium (4 files)

---

## Checkpoint: After Phase 1 (Tasks 1-4)
- [x] `npm run typecheck` passes with 0 errors
- [x] `npm test` passes (all existing 56 tests + new Phase 1 sync tests)
- [x] `npm run build` succeeds cleanly
- [x] Review backend & sync changes with user before starting Phase 2

---

## Phase 2: Frontend Resilience, Bundle Speed & CRUD Completion

### Task 5: Add `AppErrorBoundary`, live `syncQueue` notifications, and dynamic Supabase import
**Description:** Wrap app routes in a resilient React `ErrorBoundary` with clear recovery actions, add a lightweight sync-state pub/sub notifier so saving notes or rep edits updates the pending sync banner immediately without reload, and lazy-load `@supabase/supabase-js` only when Supabase environment credentials exist.

**Acceptance criteria:**
- [x] Render errors or failed lazy route imports show a styled fallback card (`Try again` / `Return to Home`) instead of a blank screen.
- [x] Saving a private note or queueing an offline write immediately updates `useSyncStatus` banner counts without navigating.
- [x] In local fallback mode (no Supabase env vars), `vendor-supabase` chunk is not fetched on initial load.
- [x] Clean Architecture tests (`boundaries.test.ts`) continue to pass 100%.

**Verification:**
- [x] Tests pass: `npm test`
- [x] Build succeeds: `npm run build` (verify chunk graph)
- [x] Manual check: Save note offline, confirm sync banner appears immediately; simulate chunk error to verify fallback UI

**Dependencies:** Task 4

**Files likely touched:**
- `src/presentation/components/ErrorBoundary.tsx`
- `src/app/router.tsx`
- `src/app/di.ts`
- `src/data/remote/supabaseClient.ts`
- `src/presentation/hooks/useSyncStatus.ts`

**Estimated scope:** Medium (5 files)

---

### Task 6: Upgrade `CourseDetailPage` with collapsible `WeekSection` accordions and add guarded soft-delete to `RepFormPage`
**Description:** Adopt the smoothly animated `WeekSection` accordion component in `CourseDetailPage` (auto-expanding the latest/active week) for faster mobile scanning, and expose a guarded Delete/Archive action with inline confirmation in `RepFormPage` edit mode using existing soft-delete (`deletedAt`) repository support.

**Acceptance criteria:**
- [x] `CourseDetailPage` renders each week inside collapsible `WeekSection` with smooth `motion` height animation and auto-expands the most recent week.
- [x] Class Reps in edit mode on `RepFormPage` can soft-delete a course, week, material, deadline, or announcement after explicit two-step confirmation, with Sonner feedback and clean redirect.
- [x] Soft-deleted items disappear immediately from course/home/deadline views and queue delete sync offline.

**Verification:**
- [x] Tests pass: `npm test`
- [x] Build succeeds: `npm run build`
- [x] Manual check: Test accordion expand/collapse on 360px mobile and soft-delete flow as Class Rep (`11S22002`)

**Dependencies:** Task 5

**Files likely touched:**
- `src/presentation/pages/CourseDetailPage.tsx`
- `src/presentation/pages/RepFormPage.tsx`
- `src/presentation/hooks/useRepForms.ts`
- `src/presentation/i18n/labels.ts`

**Estimated scope:** Medium (4 files)

---

## Checkpoint: After Phase 2 (Tasks 5-6)
- [x] `npm run typecheck` and `npm test` pass
- [x] `npm run build` succeeds cleanly
- [x] `impeccable detect src/presentation --no-advisory` reports 0 anti-patterns
- [x] Chrome DevTools visual check at 1280px & 360px (Light & Obsidian Dark)

---

## Phase 3: High-Impact Study Experience Upgrades

### Task 7: Build keyboard-accessible `Cmd/Ctrl + K` Quick Search dialog over IndexedDB
**Description:** Create a lightweight, zero-dependency Quick Search modal (`QuickSearchModal.tsx`) triggered by `Cmd/Ctrl + K` or a compact sidebar/header trigger button, powered by the existing offline `useWorkspaceSearch` hook, supporting arrow-key navigation, `Enter` jump, `Escape` close, and focus restoration.

**Acceptance criteria:**
- [ ] Pressing `Cmd+K` / `Ctrl+K` (or clicking the search button in SideNav) opens the search modal from any authenticated screen.
- [ ] Typing searches courses, materials, deadlines, and announcements directly from IndexedDB with zero network calls.
- [ ] Full keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`) works cleanly and traps/restores focus without violating WCAG AA.

**Verification:**
- [ ] Tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: Verify `Ctrl+K` navigation while browser is set to Offline in Chrome DevTools

**Dependencies:** Task 5

**Files likely touched:**
- `src/presentation/components/QuickSearchModal.tsx`
- `src/presentation/components/AppLayout.tsx`
- `src/presentation/components/AppLayout.css`
- `src/presentation/styles/pages.css`

**Estimated scope:** Medium (4 files)

---

### Task 8: Add local-first personal deadline completion checklist (`Mark done`)
**Description:** Add an additive Dexie v4 table (`deadlineCompletions`) and clean repository/usecase so each student can mark individual deadlines as completed locally on their device, with a visual completed state in `DeadlineItem`, a `"Completed"` filter option on `DeadlinesPage`, and updated remaining urgent count in the Home Study Masthead.

**Acceptance criteria:**
- [ ] Additive Dexie `version(4)` migration preserves all existing IndexedDB tables with zero data reset.
- [ ] Students can toggle any deadline as Done / Not done with immediate UI update and Sonner toast (undoable).
- [ ] Completed deadlines are reflected accurately on Home Masthead counts and `DeadlinesPage` filters.
- [ ] Domain/application unit tests verify toggle persistence and deadline urgency exclusion when completed.

**Verification:**
- [ ] Tests pass: `npm test`
- [ ] Typecheck passes: `npm run typecheck`
- [ ] Manual check: Mark a deadline done, hard-reload offline, verify state persists in IndexedDB

**Dependencies:** Task 4, Task 6

**Files likely touched:**
- `src/data/local/LiteLearnDb.ts`
- `src/domain/repositories/` & `src/application/usecases/`
- `src/presentation/pages/HomePage.tsx`
- `src/presentation/pages/DeadlinesPage.tsx`
- `src/presentation/components/FigmaComponents.tsx`

**Estimated scope:** Medium (5 files)

---

## Checkpoint: Complete (After Tasks 7-8)
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (all architecture, contrast, domain, application, and new sync/checklist tests)
- [ ] `npm run build` produces clean PWA bundle
- [ ] `impeccable detect src/presentation --no-advisory` returns 0 anti-patterns
- [ ] Chrome DevTools end-to-end offline check on Desktop (1280px) & Mobile (360px) in Light & Pitch-Black Obsidian Dark
