# Requirements: LiteLearn MVP

**Defined:** 2026-11-04
**Core Value:** Dormitory students can open followed courses, weekly materials, deadlines, and announcements offline on a 360 px phone without unexpected data use.

## v1 Requirements (MVP Scope)

### Architecture & Testing (`ARCH`)

- [ ] **ARCH-01**: Enforce strict 4-layer Clean Architecture (`domain`, `application`, `data`, `presentation`) wired manually in `src/app/di.ts` with explicit data-to-domain mappers.
- [ ] **ARCH-02**: Zero imports of React, Dexie, Supabase, or browser APIs inside `src/domain/` and `src/application/`; zero imports of `src/data/` inside `src/presentation/` (verified by automated boundary check/test).
- [ ] **ARCH-03**: UI always reads from local IndexedDB (`Dexie`) via single-action use cases, never directly from network calls.
- [ ] **ARCH-04**: Seed data uses clearly fake labels (for example `"Class A"`, `"Course A"`) isolated strictly in a dedicated seed module.
- [ ] **ARCH-05**: Vitest suite covers domain rules (`isOverdue`, `isDueSoon`, deadline sorting, email domain validation), application use cases with fake in-memory repositories, and sync success/mid-sync failure/retry paths.

### Authentication & Class Onboarding (`AUTH`)

- [ ] **AUTH-01**: User can sign up and sign in with email, password, and display name; sign-up validates IT Del campus email domains (`@students.del.ac.id`, `@del.ac.id`, configurable via env var for local testing).
- [ ] **AUTH-02**: Auth session persists locally so an already signed-in user opens the app directly to their workspace with zero network signal.
- [ ] **AUTH-03**: Signed-in user without a class can join an existing class via `joinCode` (assigned `student` role) or create a new class with generated/chosen `joinCode` (assigned `rep` role).

### Courses & Weekly Structure (`CRS`)

- [ ] **CRS-01**: Student can view all courses belonging to their class and follow or unfollow specific courses (`CourseFollow` per user).
- [ ] **CRS-02**: Only followed courses pull weekly content, deadlines, and announcements for offline storage during sync.
- [ ] **CRS-03**: Selecting a course displays ordered weeks (`Week 1`, `Week 2`, ...) containing that week's materials, deadlines, and course announcements in a text-first layout where nothing large loads automatically.

### Materials & On-Demand Files (`MAT`)

- [ ] **MAT-01**: Each material stores title, short text description, optional external link, and optional single PDF attachment metadata (`name`, `sizeBytes`, `storagePath`, max 5 MB) offline in IndexedDB.
- [ ] **MAT-02**: Material PDFs never download automatically under default settings; UI displays exact file size before user taps `Download`, stores downloaded PDF blobs in IndexedDB, marks them `Available offline`, and opens them offline.

### Deadlines & Announcements (`INFO`)

- [ ] **INFO-01**: Home screen displays `Upcoming deadlines` across followed courses sorted by `dueAt`, with explicit visual + text labels for overdue items and items due within 24 hours (in-app highlight only).
- [ ] **INFO-02**: Course announcements display short text and `postedAt` timestamp sorted newest first.

### Private Notes (`NOTE`)

- [ ] **NOTE-01**: Student can create and edit a private text note on any material, saved locally first in IndexedDB and queued in `SyncQueue` for background push.
- [ ] **NOTE-02**: Supabase Row-Level Security (RLS) enforces that notes are readable and writable exclusively by `userId = auth.uid()`, and class content is readable only by class members and writable only by that class's `rep`.

### Class Representative Input (`REP`)

- [ ] **REP-01**: Users with role `rep` can create and update courses, weeks, materials (including optional PDF <= 5 MB), deadlines, and announcements through minimal-field forms.
- [ ] **REP-02**: Rep create/update forms work offline by writing to local IndexedDB and appending operations to `SyncQueue` in the same local transaction (soft deletes via `deletedAt`).

### Offline Sync, Network Status & Data Saver (`SYNC`)

- [ ] **SYNC-01**: PWA service worker (`vite-plugin-pwa` / Workbox) caches the app shell and static chunks so reopening the app in airplane mode succeeds in under 2 seconds after first load.
- [ ] **SYNC-02**: Delta sync pulls records changed after `lastSyncAt` for followed courses (updating `lastSyncAt` only after local write succeeds) and pushes `SyncQueue` items sequentially (removing each item only after server confirmation, using `updatedAt` last-write-wins and exponential backoff with request timeouts).
- [ ] **SYNC-03**: Sync runs automatically on app open, on network recovery, every 5 minutes while open and online, and via a manual `Sync now` button; mid-sync failures never delete or corrupt local data.
- [ ] **SYNC-04**: Status bar displays `Offline`, `Slow` (verified via real lightweight probe/request latency > 3 s or failure so "connected but no internet" is detected), or `Online`, alongside `Last updated: <time>` and pending sync count on Home.
- [ ] **SYNC-05**: Settings screen provides a `Data saver` toggle (ON by default) and Light/Dark theme toggle; when `Data saver` is OFF, sync may auto-download material PDFs under 1 MB for followed courses.

### Low-Bandwidth, Mobile & Design Quality (`QUAL`)

- [ ] **QUAL-01**: Initial JS bundle measures under 200 KB gzipped using route-level code splitting, system font stack only, and zero external icon/UI bloat.
- [ ] **QUAL-02**: UI implements `DESIGN.md` (`ENERGY 1 / RHYTHM 1 / MOTION 1`), centralizes all UI strings in `src/presentation/i18n/labels.ts`, holds up cleanly at 360 px width and 200% zoom with >= 44 px tap targets, provides explicit Empty/Loading/Error states on every data screen, meets WCAG AA contrast in both Light and Dark themes, and passes full keyboard navigation.

## v2 / Post-MVP Candidates (Deferred)

- **I18N-01**: Indonesian translation toggle consuming `labels.ts`.
- **TRIAL-01**: Post-trial measurement summary after running the dorm trial.

## Out of Scope (Strictly Excluded per PRD Section 6)

| Feature | Reason |
|---|---|
| Official IT Del e-learning integration or scraping | Forbidden by scope; class reps input structured updates directly |
| AI features (summaries, chat, recommendations) | Excluded from MVP scope and adds bandwidth/latency overhead |
| Video, audio, image uploads, chat, comments, social feeds | Violates strict low-bandwidth constraint |
| Push notifications | Excluded; in-app 24-hour deadline highlight only |
| Admin panel, analytics dashboard, or payments | No admin role; class creator receives `rep` role |
| Native iOS / Android wrappers | Web PWA only |
| Multi-university or multi-language UI in MVP | English-only UI for MVP (`labels.ts` ready for later translation) |

## Traceability

| Requirement | Phase | Status |
|---|---|---|
| ARCH-01 | Phase 1 | Pending |
| ARCH-02 | Phase 1 | Pending |
| ARCH-03 | Phase 1 | Pending |
| ARCH-04 | Phase 1 | Pending |
| ARCH-05 | Phase 1 (rules/core use cases) & Phase 2 (sync/offline use cases) | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| CRS-01 | Phase 1 | Pending |
| CRS-02 | Phase 1 & Phase 2 | Pending |
| CRS-03 | Phase 1 | Pending |
| MAT-01 | Phase 1 | Pending |
| MAT-02 | Phase 2 | Pending |
| INFO-01 | Phase 1 | Pending |
| INFO-02 | Phase 1 | Pending |
| NOTE-01 | Phase 2 | Pending |
| NOTE-02 | Phase 1 (schema/RLS) & Phase 2 (notes sync) | Pending |
| REP-01 | Phase 1 | Pending |
| REP-02 | Phase 2 | Pending |
| SYNC-01 | Phase 2 | Pending |
| SYNC-02 | Phase 2 | Pending |
| SYNC-03 | Phase 2 | Pending |
| SYNC-04 | Phase 2 | Pending |
| SYNC-05 | Phase 2 | Pending |
| QUAL-01 | Phase 1 & Phase 3 (measured gate) | Pending |
| QUAL-02 | Phase 1, Phase 2 & Phase 3 (full audit) | Pending |

**Coverage:**
- MVP requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-11-04*
