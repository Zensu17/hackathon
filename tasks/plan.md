# Implementation Plan: LiteLearn Frontend & Backend Hardening + UX Upgrade

## Overview

This plan addresses concrete bugs, security gaps, offline-sync data-loss risks, and high-impact UX opportunities found by auditing the LiteLearn codebase across `supabase/migrations/`, `src/data/`, `src/app/`, and `src/presentation/`. Work is ordered bottom-up by dependency graph and split into small, independently verifiable vertical slices covering: (1) critical backend/sync correctness and security, (2) performance and low-bandwidth optimization, and (3) high-leverage frontend usability and resilience upgrades.

Assumed operating load: 1-30 concurrent IT Del cohorts (30-60 students per class, 1-2 class reps per class) reading on 360px phones over intermittent evening dormitory Wi-Fi, with optional Supabase backend or local IndexedDB fallback.

## Audit Summary (Evidence-Backed Findings)

### Must Fix (Bugs, Data Loss, Security)
1. **Offline PDF upload & update sync fails silently (`HybridMaterialRepository.ts:L149-168, L252-272`, `SupabaseRemoteDataSource.ts:L843-857`, `LiteLearnSyncService.ts:L246-248`)**
   - Creating/editing a material with a PDF offline stores bytes in `materialBlobs` but `pushQueueItem` never uploads the blob to Supabase Storage. Offline updates also omit `courseId`, breaking Postgres `NOT NULL` and RLS on `upsertMaterialPayload`, and ignore `removeAttachment: true`.
2. **Offline `followCourse` / `unfollowCourse` throws in remote mode (`HybridCourseRepository.ts:L56-145`)**
   - Unlike courses/deadlines/materials, course follow toggles call Supabase directly with no offline fallback or `syncQueue` outbox support.
3. **Private notes are never pulled back from Supabase (`SupabaseRemoteDataSource.ts:L707-757`, `HybridAuthRepository.ts:L306-391`, `LiteLearnSyncService.ts:L125-187`)**
   - Notes sync upward (`upsertNote`), but there is no `fetchUserNotes(userId)` pull on sign-in or sync. Signing in on a second device leaves notes empty even though they exist in Postgres.
4. **Expired cached signed URLs break PDF downloads after 1 hour (`HybridMaterialRepository.ts:L303-315`)**
   - `downloadRemoteFile` reuses stale `attachment.remoteUrl` instead of minting a fresh signed URL from `storagePath`.
5. **Blind IndexedDB wipe on any `open()` failure (`LiteLearnDb.ts:L197-206`)**
   - `open().catch()` deletes the entire local database on any error (including multi-tab lock or quota errors), risking silent loss of unsynced offline notes and queued rep writes.
6. **Missing React ErrorBoundary (`src/app/router.tsx`)**
   - Lazy route chunk failure on flaky Wi-Fi or any render error produces a blank screen with no recovery UI.

### Should Fix (Security, Low-Bandwidth Scale, Sync UX)
7. **Full-table pull + N+1 signed-URL fan-out on every sync (`SupabaseRemoteDataSource.ts:L707-757`, `LiteLearnSyncService.ts:L125-187`)**
   - Every 5-minute sync redownloads all followed rows and fires N separate `createSignedUrl` requests. Switching to `updated_at > last_sync_at` delta pulls and on-demand URL signing cuts sync bandwidth dramatically.
8. **Missing HTTP security headers & Postgres RLS edge cases (`vercel.json`, `001_initial_schema.sql`, `002_nim_auth.sql`)**
   - `vercel.json` omits `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`.
   - `notes_insert_own` does not verify `material_id` belongs to the caller's class; `002_nim_auth.sql` uses hardcoded fallback `'11S22001'` when metadata/email is empty; `join_class_by_code` allows an active rep to accidentally demote themselves without check.
9. **Stale pending-sync banner until reload (`useSyncStatus.ts:L20-100`)**
   - Writes to `syncQueue` do not notify `useSyncStatus`, so students do not immediately see `"1 change waiting to sync"` after saving a note offline.
10. **Supabase SDK (`227 kB`) bundled eagerly even in local/offline mode (`src/app/di.ts`, `src/data/remote/supabaseClient.ts`)**
    - Dynamically loading `@supabase/supabase-js` only when credentials are configured saves ~59 kB gzip on initial load for local/demo mode.

### High-Impact Frontend & Hackathon Polish
11. **Adopt smooth `WeekSection` accordions in `CourseDetailPage.tsx`** (auto-expand current/latest week instead of long flat stacked cards on mobile).
12. **Complete Rep CRUD with guarded Soft-Delete (`RepFormPage.tsx`)** using existing `deletedAt` repository support + confirmation UI.
13. **Keyboard-first Global Quick Search (`Cmd/Ctrl + K`)** reusing existing `useWorkspaceSearch` IndexedDB engine + `motion` modal overlay.
14. **Personal Deadline Checklist (`Done` toggle per student)** stored locally in IndexedDB so students can check off submitted tasks and track real progress.

## Architecture Decisions

- **Preserve Clean Architecture boundaries (`boundaries.test.ts`):** All domain rules remain pure (zero browser/SDK imports); `src/presentation` never imports `dexie` or `@supabase/supabase-js`.
- **Reversible Postgres migration (`003_sync_and_rls_hardening.sql`):** Use `create or replace` and `drop policy if exists` / `create policy` so migrations remain idempotent and reversible.
- **No unnecessary dependencies:** All tasks reuse existing `dexie`, `motion`, `sonner`, and React 18 primitives. Zero new npm packages required.
- **On-demand signed URLs:** Never store short-lived Supabase signed URLs as authoritative in IndexedDB; always mint via `storagePath` right when downloading or opening online.

## Dependency Graph

```text
Phase 1: Backend Reliability & Security
  Task 1 (Migration 003: RLS hardening + NIM fallback fix + vercel.json security headers)
    └── Task 2 (Material offline PDF sync + courseId/removeAttachment fix + fresh signed URLs)
    └── Task 3 (Offline course_follow outbox + bidirectional private notes pull sync)
    └── Task 4 (True delta sync via updated_at + remove N+1 eager URL signing + safe LiteLearnDb.open)
          │
Phase 2: Frontend Resilience & Real-Time Sync UX
          ├── Task 5 (Reactive sync-queue notification bus + AppErrorBoundary + lazy Supabase chunk)
          └── Task 6 (CourseDetailPage WeekSection accordions + RepFormPage guarded soft-delete)
          │
Phase 3: High-Impact Study Features
          ├── Task 7 (Global Cmd/Ctrl + K Quick Search modal over IndexedDB)
          └── Task 8 (Student personal deadline completion checklist + Home progress summary)
```

## Task List

### Phase 1: Backend Reliability, Offline Sync & Security
- [x] Task 1: Harden Postgres RLS, NIM trigger fallback, and Vercel security headers (S)
- [x] Task 2: Fix offline material PDF upload/removal sync and fresh signed URL minting (M)
- [x] Task 3: Add offline-first `course_follow` outbox and bidirectional private notes pull (M)
- [x] Task 4: Implement true `updated_at` delta sync, remove N+1 URL signing, and guard `LiteLearnDb.open()` (M)

### Checkpoint 1: Backend & Sync Integrity
- [x] `npm run typecheck`, `npm test`, and new unit tests for offline PDF sync, course_follow queue, note pull, and delta sync all pass

### Phase 2: Frontend Resilience, Bundle Speed & CRUD Completion
- [x] Task 5: Add `AppErrorBoundary`, live `syncQueue` event notifications, and dynamic Supabase import (M)
- [x] Task 6: Upgrade `CourseDetailPage` with collapsible `WeekSection` accordions and add guarded soft-delete to `RepFormPage` (M)

### Checkpoint 2: Resilience & Build Verification
- [x] `npm run build` succeeds with reduced local-mode entry bundle; manual Chrome DevTools check on Desktop + Mobile (Light & Obsidian Dark)

### Phase 3: High-Impact Study Experience Upgrades
- [x] Task 7: Build keyboard-accessible `Cmd/Ctrl + K` Quick Search dialog powered by IndexedDB `useWorkspaceSearch` (M)
- [x] Task 8: Add local-first personal deadline completion checklist (`Mark done`) with progress reflection on Home & Deadlines (M)

### Checkpoint 3: Release Readiness
- [x] `npm run typecheck`, `npm test`, `npm run build`, `impeccable detect src/presentation --no-advisory` all pass with 0 errors
- [x] Full offline hard-reload verification in Chrome DevTools at 360px and 1280px (Light & Obsidian Dark)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Delta sync (`updated_at > since`) misses older rows when a student follows a new course mid-semester | High | Trigger a full single-course hydration when `followCourse` executes (already done in `HybridCourseRepository`), and use `sinceIso` only for already-hydrated followed courses. |
| Pull sync overwrites a student's unsynced offline private note | High | Before applying pulled `notes` rows in `LiteLearnSyncService`, skip any `materialId` that currently has a pending `note` item in `syncQueue` or a newer local `updatedAt`. |
| Dynamic import of `@supabase/supabase-js` breaks Vitest boundary tests in `boundaries.test.ts` | Medium | Keep dynamic import strictly inside `src/data/remote/supabaseClient.ts` (never inside `src/app/router.tsx` or `src/presentation/`), and verify `boundaries.test.ts` immediately. |
| Adding Dexie schema v4 for personal deadline completions breaks existing browser IndexedDB | Medium | Add a non-destructive `version(4)` additive store (`deadlineCompletions: '[userId+deadlineId], userId, deadlineId'`) without altering or clearing existing tables. |

## Open Questions

1. **Scope priority:** Do you want to execute **all 3 phases** (Backend hardening + Frontend resilience + Cmd+K & Deadline Checklist), or start with **Phase 1 + Phase 2** first so core sync/security/CRUD are rock-solid before adding new study features?
2. **Supabase deployment target:** Will this hackathon demo run primarily in **Local IndexedDB demo mode** or connected to a **live Supabase project**? (Both modes benefit from this plan, and if live Supabase is active we should also verify applying `003_sync_and_rls_hardening.sql`.)
3. **Deadline completion sync:** Should `"Mark done"` on deadlines be **device-local only** (fast, zero migration risk) or also synced to a new `public.deadline_completions` table in Supabase?
