---
phase: post-phase-01
reviewed: 2026-11-24T01:51:28Z
depth: standard
diff_base: c4816da
files_reviewed: 80
reports:
  - .planning/reviews/post-phase-01-core-REVIEW.md
  - .planning/reviews/post-phase-01-ui-REVIEW.md
findings:
  critical: 13
  warning: 27
  info: 11
  total: 51
  necessity: 2
status: issues_found
---

# Post-Phase 1 Consolidated Code Review Report

**Reviewed:** 2026-11-24T01:51:28Z
**Diff Base:** `c4816da..HEAD`
**Depth:** standard
**Files Reviewed:** 80 (51 Core/Data/SQL/Config + 29 Presentation/Router/Hooks)
**Status:** `issues_found`

## Executive Summary

Two parallel `gsd-code-reviewer` passes audited every non-test source file changed since Phase 1 completion (`c4816da`):
- **Core & Data Review (51 files):** 9 Critical, 14 Warning (1 necessity), 5 Info — [post-phase-01-core-REVIEW.md](post-phase-01-core-REVIEW.md)
- **Presentation & Hooks Review (29 files):** 4 Critical, 13 Warning (1 necessity), 6 Info — [post-phase-01-ui-REVIEW.md](post-phase-01-ui-REVIEW.md)

**Verified Clean:**
- **Clean Architecture import boundaries:** Zero React, Dexie, Supabase, or browser imports in `src/domain/` and `src/application/`; zero `src/data`, `dexie`, or `@supabase/supabase-js` imports in `src/presentation/`.
- **External `<a>` link sanitization:** External anchors in `MaterialDetailPage.tsx` enforce `isSafeHttpUrl` (`http:`/`https:` only) and `rel="noopener noreferrer"`.
- **Baseline checks:** `npm run typecheck` passes cleanly and `npm test` passes 14 test files (65 tests).

> Two critical issues were independently corroborated across both layers: unvalidated PDF `blob:` MIME XSS (`Core CR-01` + `UI CR-01`) and offline replacement PDF self-deletion (`Core CR-09` + `UI CR-03`).

---

## Critical Findings (13 total — 11 unique root issues)

### Core & Data (`post-phase-01-core-REVIEW.md`)
- **CORE CR-01 — Stored XSS / captive-portal corruption via offline PDF `blob:` MIME type:** `HybridMaterialRepository.ts:327-341, 377-430`, `DownloadMaterialFile.ts:45-60`, `LiteLearnSyncService.ts:431-438`. Remote HTTP `Content-Type` is persisted without validating `application/pdf` or `%PDF-` magic bytes, enabling same-origin script execution if HTML/SVG is cached and opened via `blob:`.
- **CORE CR-02 — Duplicate local note rows & invisible remote edits:** `SupabaseRemoteDataSource.ts:813-832`, `LiteLearnSyncService.ts:274-320`, `HybridAuthRepository.ts:395-397`, `LiteLearnDb.ts:190`. Remote `upsertNote` omits `id`, causing Postgres to generate a different UUID than Dexie; `bulkPut` inserts a second row for `[userId+materialId]` instead of replacing the local row.
- **CORE CR-03 — Broken LWW & out-of-order outbox replay:** `SupabaseRemoteDataSource.ts:813-832`, `DexieSyncQueueRepository.ts:38-52`, `LiteLearnSyncService.ts:113-190, 219-272`. `upsertNote` drops client `updatedAt`; non-coalesced outbox items replay stale backed-off edits after newer edits; delta pulls overwrite pending local rep edits.
- **CORE CR-04 — Delta sync watermark gaps & dropped hydration:** `LiteLearnSyncService.ts:110-208`. `last_sync_at` uses client clock *after* pulls and PDF prefetching; `newlyFollowedCourseIds` is in-memory only and lost on pull failure; `course_follows`/`classes`/`profiles` are never pulled.
- **CORE CR-05 — Cross-user `syncQueue` & `last_sync_at` poisoning after default `signOut()`:** `HybridAuthRepository.ts:428-459`, `LiteLearnSyncService.ts:23, 89-129`. Default `signOut()` leaves unscoped queue items and watermark in IndexedDB; the next user pushes them under their own JWT.
- **CORE CR-06 — Remote `SignUp` orphans accounts and omits local class/courses:** `SupabaseRemoteDataSource.ts:147-195`, `HybridAuthRepository.ts:186-208`. Calls `auth.signUp` before validating `classCode` (blocking retries as `DUPLICATE_NIM`) and discards `currentClass` / never hydrates `db.classes` or `db.courses`.
- **CORE CR-07 — SQL security defects in Migration 003:** `supabase/migrations/003_sync_and_rls_hardening.sql:4-15, 40-71`. `public.material_class_id(uuid)` is `SECURITY DEFINER` executable by `PUBLIC`/`anon` (cross-class oracle); `handle_new_auth_user` trusts unvalidated client metadata `nim` with no `CHECK` constraint (NIM squatting).
- **CORE CR-08 — Destructive `LiteLearnDb.open()`:** `src/data/local/LiteLearnDb.ts:277-299`. Calls `this.delete()` on `VersionError`/`UpgradeError`/`SchemaError`, wiping unsynced queue items, notes, local credentials, and offline PDFs.
- **CORE CR-09 — Material attachment corruption:** `LiteLearnSyncService.ts:244-259, 373-410`, `SupabaseRemoteDataSource.ts:563-627, 897-925`, `HybridMaterialRepository.ts:192-207, 432-483`. Removing offline blobs breaks pending uploads (dangling 404 storage path); `removeAttachment: true` + replacement PDF deletes the new upload and nulls DB columns; online updates and delta pulls leave stale blobs.

### Presentation & Hooks (`post-phase-01-ui-REVIEW.md`)
- **UI CR-01 — Same-origin XSS from unpinned `stored.mimeType` in PDF `Blob` URLs:** `MaterialDetailPage.tsx:108-112`, `HomePage.tsx:149-153`, `CourseDetailPage.tsx:108-112`. Corroborates `CORE CR-01`; always pin `type: 'application/pdf'`.
- **UI CR-02 — Silent note loss & cross-material corruption in `useMaterialNote`:** `src/presentation/hooks/useMaterialNote.ts:33-119`, `MaterialDetailPage.tsx:528-536`. Drops dirty debounced edits on Prev/Next navigation/unmount, applies stale in-flight saves to the newly opened material, and keeps Material A's note if Material B fails to load.
- **UI CR-03 — `RepFormPage` keeps `removeAttachment: true` when choosing a replacement PDF:** `src/presentation/pages/RepFormPage.tsx:608-639, 724-734, 1264-1286`. Corroborates `CORE CR-09`; hiding the checkbox without resetting `removeAttachment = false` causes sync to delete same-named replacement PDFs.
- **UI CR-04 — Frozen `"Syncing..."` button in local mode & unhandled `retry()` rejections:** `src/presentation/hooks/useSyncStatus.ts:44-69`, `LiteLearnSyncService.ts:107`, `SettingsPage.tsx:274-286`, `AppLayout.tsx:373-389`. Local fallback returns `isSyncing: true` before `finally`, freezing Settings' `"Sync now"` button; `retry()` lacks `try/catch`.

---

## Summary of Warnings (27 total, incl. 2 necessity) & Info (11 total)

- **Core Warnings (`WR-01`–`WR-14`):** Missing CSP/HSTS headers in `vercel.json`; unsalted single-round SHA-256 local passwords; upload validation trusting `sizeBytes` / empty MIME; permanently cached rejected dynamic Supabase import; duplicated `isNetworkFailure` missing iOS Safari `"Load failed"` & non-idempotent `create*` inserts; outbox dependency ordering & infinite poison-pill retries; `23505`/`28000` error misclassification & `SignIn` masking outages; incomplete `initPromise` guards & seeder resurrecting unfollowed courses; soft-deleted week leaks in `SearchWorkspace`/`GetOfflineStudyOverview` & `getOfflineFile`; `BrowserNetworkStatusService` ignoring `VITE_SUPABASE_URL`, CORS root probes, & offline race; local PDF caching mutating material `updatedAt`; non-atomic `ToggleDeadlineCompletion` & `signOut` wipe; class-switch stale `course_follows` & `create_class_as_rep` guard; necessity finding (`Object.setPrototypeOf` in `AppError.ts`).
- **UI Warnings (`WR-01`–`WR-13`):** `window.open(..., 'noopener,noreferrer')` always returning `null` (duplicate PDF download on every click); `QuickSearchModal` hijacking `Enter` on buttons + focus escape + ARIA `listbox` contract; missing async cancellation guards (`RepFormPage`, `useMaterialDetail`, `useHomeWorkspace`, `useUpcomingDeadlines`); duplicated `useSyncStatus` instances & `SettingsPage` ignoring sync failures/backoff retry; false-success follow toasts & missing `HomePage` `toggleDisabled`; unhandled async promise rejections; `RepFormPage` file input `.value` not cleared / drop while busy / missing class ownership check; ARIA issues in `SegmentedControl` & `MaterialRow`; missing `RepRouteGuard` on `/manage` & `LazyScreen` `resetKey` omitting `location.search`; replayed nav toasts & stale `pdfError`; `SettingsPage` copy timer leak & missing Clipboard fallback; `mapAuthError` matching `'nim'` before `'password'`; necessity finding (unread `useAuthSession().error`).
- **Info (`Core IN-01`–`IN-05`, `UI IN-01`–`IN-06`):** Fractional `limit` in `ListRecentAnnouncements`, unused `isDueForRetry` & `NaN` backoff guard, dead exports, hardcoded demo IDs/credentials, monolithic `RepFormPage.tsx`, unused components in `FigmaComponents.tsx`, `ErrorBoundary` details, synthetic `KeyboardEvent` & landmark labels, `CourseCard` text-selection click.

See full file-by-file evidence and fix snippets in:
- [post-phase-01-core-REVIEW.md](post-phase-01-core-REVIEW.md)
- [post-phase-01-ui-REVIEW.md](post-phase-01-ui-REVIEW.md)
