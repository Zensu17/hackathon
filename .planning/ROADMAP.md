# Roadmap: LiteLearn MVP

## Overview

LiteLearn ships across three milestone-aligned phases over roughly three weeks. Phase 1 establishes strict Clean Architecture, Dexie local storage, Supabase schema/RLS, fake seed data, and core student/rep screens reading exclusively from IndexedDB. Phase 2 delivers the PWA service worker, outbox sync engine, connectivity verification (`Offline` / `Slow` / `Online`), on-demand PDF caching, private notes, offline rep editing, and Data Saver controls. Phase 3 hardens 360 px mobile layout and accessibility, measures the gzipped bundle against the 200 KB cap, completes the Section 12 acceptance checklist, and prepares Vercel deployment and trial onboarding.

**Mandatory milestone gate:** After completing each phase, stop, run the Antislop Delivery Gate (`DESIGN.md` + core + companion checklists), summarize what was built, and provide step-by-step verification instructions before advancing.

## Phases

- [x] **Phase 1: Foundation and Core Screens (Milestone 1, Week 1)** - Clean Architecture scaffolding, domain entities/rules + unit tests, Dexie local DB + fake seed, Supabase schema/RLS/Auth, and core student + online rep screens. (Completed: 2026-11-04)
- [ ] **Phase 2: Offline PWA and Delta Sync (Milestone 2, Week 2)** - Workbox app-shell caching, outbox + delta pull/push sync, real-probe network indicator, on-demand PDF download, private notes, Data Saver toggle, and offline rep forms.
- [ ] **Phase 3: Trial Readiness and Polish (Milestone 3, Week 3)** - 360 px / 200% zoom polish, gzipped bundle measurement (< 200 KB), full Section 12 manual acceptance verification, deployment README, and trial readiness package.

## Phase Details

### Phase 1: Foundation and Core Screens
**Goal**: Students can sign up with an IT Del campus email, create or join a class, follow courses, and browse weekly materials, upcoming deadlines, and announcements read strictly from IndexedDB, while class reps can add courses and weekly content when online.
**Depends on**: Nothing (first phase)
**Requirements**: `ARCH-01`, `ARCH-02`, `ARCH-03`, `ARCH-04`, `ARCH-05` (domain rules & core use cases), `AUTH-01`, `AUTH-02`, `AUTH-03`, `CRS-01`, `CRS-02` (local follow state), `CRS-03`, `MAT-01`, `INFO-01`, `INFO-02`, `NOTE-02` (Supabase schema & RLS migration), `REP-01`, `QUAL-01` (route-level lazy splitting & plain CSS setup), `QUAL-02` (`DESIGN.md` tokens, light/dark toggle, `labels.ts`, Empty/Loading/Error states)
**Success Criteria** (what must be TRUE):
  1. `src/domain/` and `src/application/` pass automated import-boundary checks (zero React, Dexie, Supabase, or browser imports) and `src/presentation/` never imports `src/data/`.
  2. Vitest unit tests pass for domain rules (`isOverdue`, `isDueSoon`, deadline sorting, IT Del email validation) and Phase 1 application use cases using fake in-memory repositories.
  3. A user can sign up with `@students.del.ac.id` or `@del.ac.id` (or local dev override), create a class (`rep`) or join via `joinCode` (`student`), and see fake seed data (`"Class A"`, `"Course A"`) only when running the explicit local seed helper.
  4. Students can follow/unfollow class courses and view ordered weeks, material text/links, newest-first announcements, and Home upcoming deadlines (highlighting overdue and due-within-24h items in rust accent), all read from Dexie via use cases.
  5. A `rep` user can create/update courses, weeks, materials (metadata + optional <= 5 MB PDF upload), deadlines, and announcements while online, with changes persisted to Supabase and reflected locally in Dexie.
  6. Light and Dark themes, keyboard focus indicators, >= 44 px touch targets, and Empty/Loading/Error states pass the Antislop Delivery Gate.
**Plans**: 3 plans

Plans:
- [x] `01-01-PLAN.md` - Vite + React + TS strict + Vitest scaffolding, `DESIGN.md` CSS tokens, `labels.ts`, complete `domain/` layer, domain unit tests, and Clean Architecture boundary checks
- [x] `01-02-PLAN.md` - All 23 Phase 1 `application/` use cases + fake-repo tests, `LiteLearnDb` Dexie schema + mappers + isolated fake `seed.ts`, Supabase SQL/RLS migration, local-first repositories, and `src/app/di.ts`
- [x] `01-03-PLAN.md` - Route-split `presentation/` shell and all 8 Phase 1 pages, WCAG contrast + gzipped bundle (< 200 KB) checks, real browser click-through verification, and Milestone 1 Antislop Delivery Gate report

### Phase 2: Offline PWA and Delta Sync
**Goal**: After one sign-in and initial sync, the entire app shell and followed-course content open offline, material PDFs download only on demand into IndexedDB, private notes and rep edits queue offline and sync automatically with resilience against weak dorm Wi-Fi, and network/sync status is accurately reported.
**Depends on**: Phase 1
**Requirements**: `ARCH-05` (sync & offline queue tests), `CRS-02` (delta sync scoped to followed courses), `MAT-02`, `NOTE-01`, `NOTE-02` (end-to-end RLS + sync), `REP-02`, `SYNC-01`, `SYNC-02`, `SYNC-03`, `SYNC-04`, `SYNC-05`, `QUAL-02`
**Success Criteria** (what must be TRUE):
  1. Installing/loading LiteLearn once and switching to airplane mode still opens the cached PWA shell in under 2 seconds and renders followed courses, weeks, material text/links, deadlines, and announcements from IndexedDB.
  2. Material PDFs display their exact byte size and never download automatically under default Data Saver ON; tapping `Download` stores the PDF in IndexedDB, marks it `Available offline`, and opens it with network disabled.
  3. Private student notes and `rep` offline creates/updates write atomically to Dexie + `SyncQueue` and push sequentially when connectivity returns without losing local data if a request fails or times out midway.
  4. Vitest sync suite passes for full delta pull + outbox push success, mid-sync network failure (verifying `lastSyncAt` and unconfirmed queue items remain intact), and exponential backoff retry.
  5. Status indicator accurately distinguishes `Offline`, `Slow` (> 3 s probe latency or failed probe when `navigator.onLine` is true, catching "connected but no internet"), and `Online`, alongside `Last updated: <time>` and pending sync count on Home.
  6. Turning `Data saver` OFF in Settings allows sync to prefetch material PDFs under 1 MB for followed courses while keeping larger PDFs manual.
**Suggested Plan Breakdown** (for `/gsd-plan-phase 2`):
  - `02-01`: Outbox `SyncQueue` transactions, `RunSync` / `GetSyncStatus` use cases (delta pull after `lastSyncAt`, ordered push, `updatedAt` LWW, soft delete `deletedAt`, exponential backoff) + comprehensive Vitest sync failure/retry tests.
  - `02-02`: Real-probe `NetworkStatusService` (`Offline` / `Slow` / `Online`), auto/manual sync triggers (startup, online recovery, 5-min interval, `Sync now`), offline Rep CRUD wiring, and Home/header sync status bar.
  - `02-03`: On-demand Material PDF download/offline blob storage (`DownloadMaterialFile`), Data Saver sub-1 MB sync rule, private `Note` local-first editor + RLS verification, `vite-plugin-pwa` Workbox app-shell caching, and Milestone 2 Delivery Gate report.

### Phase 3: Trial Readiness and Polish
**Goal**: Verify LiteLearn meets every Section 12 acceptance criterion, stays well below the 200 KB gzipped initial JS ceiling, handles 360 px dorm phones and 200% zoom cleanly, and ships deployment + trial setup documentation ready for real class rep onboarding.
**Depends on**: Phase 2
**Requirements**: `QUAL-01` (verified bundle report), `QUAL-02` (360 px, zoom, keyboard, contrast audit), plus end-to-end verification of all 26 v1 requirements against PRD Section 12
**Success Criteria** (what must be TRUE):
  1. Production build reports exact initial JS gzipped size (verified < 200 KB) with route-level chunk breakdown recorded honestly.
  2. Every screen (`SignIn`, `JoinClass`, `Home`, `Courses`, `CourseDetail`, `MaterialDetail`, `RepForm`, `Settings`) passes 360 px viewport, 200% text zoom, keyboard-only navigation, Light/Dark WCAG AA contrast, and Empty/Loading/Error state checks with zero console errors.
  3. All items in PRD Section 12 Acceptance Criteria (Offline, Sync, Status, Low bandwidth, Roles & privacy, Clean Architecture boundaries) are executed and evidenced.
  4. `vercel.json` SPA rewrite/cache config, `.env.example`, Supabase setup/RLS guide, and concise `README.md` allow deploying and onboarding 1 trial class with 1 to 2 real courses entered by a `rep` (without bundling fake seed data into production).
**Suggested Plan Breakdown** (for `/gsd-plan-phase 3`):
  - `03-01`: Bundle measurement & optimization (< 200 KB gzipped), 360 px & 200% zoom responsive audit, keyboard/focus/contrast verification, and bug fixes.
  - `03-02`: Vercel static deployment config, Supabase setup + RLS verification script/instructions, `README.md`, trial onboarding checklist, and final Section 12 + Antislop Delivery Gate sign-off.

## Progress

| Phase | Plans Complete | Status | Completed |
|---|---|---|---|
| 1. Foundation and Core Screens | 3/3 | Complete | 2026-11-04 |
| 2. Offline PWA and Delta Sync | 0/3 | Not started | - |
| 3. Trial Readiness and Polish | 0/2 | Not started | - |
