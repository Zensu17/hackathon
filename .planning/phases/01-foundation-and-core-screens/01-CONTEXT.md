# Phase 1: Foundation and Core Screens - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning
**Source:** LiteLearn PRD (Sections 0, 5.1-5.6, 5.8, 7, 8, 10, 11, 12, 13) + user Q&A + [DESIGN.md](file:///c:/Users/grego/OneDrive/Documents/sem%203/gabut/hacketon/DESIGN.md)

<domain>
## Phase Boundary

Deliver Milestone 1 (Foundation and Core Screens):
1. Project scaffolding: Vite + React + TypeScript (`strict: true`), `react-router` with route-level `React.lazy` splitting, plain CSS / CSS Modules implementing `DESIGN.md` tokens, and Vitest.
2. Clean Architecture layers (`domain`, `application`, `data`, `presentation`) wired manually in `src/app/di.ts`, verified by an automated import-boundary test in `src/tests/architecture/`.
3. Complete Domain entities, repository interfaces, service interfaces, and pure domain rules (`isOverdue`, `isDueSoon`, `sortDeadlines`, `isAllowedCampusEmail`, `validateMaterialFile`) with unit tests.
4. Application single-action use cases for Auth (`SignUp`, `SignIn`, `SignOut`, `GetCurrentUser`, `JoinClass`, `CreateClass`), Courses (`ListCourses`, `FollowCourse`, `UnfollowCourse`), Content (`GetCourseWeeks`, `GetMaterial`), Deadlines (`GetUpcomingDeadlines`), Announcements (`ListAnnouncements`), and Rep online management (`CreateCourse`, `UpdateCourse`, `CreateWeek`, `UpdateWeek`, `CreateMaterial`, `UpdateMaterial`, `CreateDeadline`, `UpdateDeadline`, `CreateAnnouncement`, `UpdateAnnouncement`) with unit tests using fake in-memory repositories.
5. Data layer: Dexie local IndexedDB tables, explicit row-to-entity mappers, isolated fake seed module (`src/data/local/seed.ts` using clearly fake names such as `"Class A"`, `"Course A"`), Supabase SQL migration + RLS (`supabase/migrations/001_initial_schema.sql`), and repository implementations that always keep Dexie as the UI read source while persisting Phase 1 writes online (with a clean `di.ts` local-adapter fallback when `VITE_SUPABASE_URL` is unset so local development and browser click-through tests run without external credentials).
6. Presentation screens (`SignIn`, `JoinClass`, `Home`, `Courses`, `CourseDetail`, `MaterialDetail`, `RepForm`, `Settings` with Light/Dark theme toggle), centralized `src/presentation/i18n/labels.ts`, full Empty/Loading/Error states (`R-27`), keyboard accessibility (`R-32`), 360 px mobile layout + 44 px touch targets (`R-03`), and Milestone 1 Antislop Delivery Gate verification.

Out of Phase 1 boundary (deferred to Phase 2):
- Service worker / `vite-plugin-pwa` offline shell caching (`SYNC-01`).
- Outbox `SyncQueue` background pull/push engine, offline rep writes, and `Offline`/`Slow`/`Online` probe indicator (`REP-02`, `SYNC-02..04`).
- On-demand PDF blob download into IndexedDB (`DownloadMaterialFile`, `MAT-02`), private student `Note` UI (`NOTE-01`), and `Data saver` toggle (`SYNC-05`). Note: in Phase 1, `MaterialDetail` must display attachment filename and exact byte size without auto-downloading, and either omit any dead download button or clearly label offline PDF caching if deferred to Phase 2 (`R-26`: zero dead controls).

</domain>

<decisions>
## Implementation Decisions

### Clean Architecture & Folder Layout (Mandatory)
- Follow the exact folder structure from PRD Section 8.4:
  - `src/app/` (`di.ts`, `router.tsx`, `main.tsx`)
  - `src/domain/` (`entities/`, `repositories/`, `services/`, `rules/`)
  - `src/application/` (`usecases/auth/`, `usecases/courses/`, `usecases/content/`, `usecases/deadlines/`, `usecases/announcements/`, `usecases/rep/`, `dto/`)
  - `src/data/` (`local/`, `remote/`, `repositories/`, `mappers/`)
  - `src/presentation/` (`pages/`, `components/`, `hooks/`, `i18n/labels.ts`, `styles/`)
  - `src/tests/` (`domain/`, `application/`, `architecture/`)
- Dependencies point inward only:
  - `src/domain/` imports nothing outside `src/domain/`.
  - `src/application/` imports only `src/domain/` and `src/application/`.
  - `src/presentation/` imports only `src/presentation/`, `src/application/`, `src/domain/`, and `src/app/di.ts` context hooks (never `src/data/`).
- Every entity has `id` (UUID), `createdAt`, `updatedAt`, and `deletedAt` (`string | null`) except local join/queue helpers (`CourseFollow`, `SyncQueueItem`) as defined in PRD Section 11.

### Auth, Campus Email & Class Roles
- Sign-up requires an IT Del email domain (`@students.del.ac.id` or `@del.ac.id`), configurable via `VITE_ALLOWED_EMAIL_DOMAINS` for local testing.
- Auth session persists locally in IndexedDB/storage so reopening the app with no network still resolves the current signed-in user (`AUTH-02`).
- On `JoinClass` onboarding, a signed-in user without a `classId` can either:
  - Enter an existing `joinCode` to join as `student`, or
  - Create a new class (`name` + generated or custom `joinCode`) and receive role `rep`.
- Users with role `rep` can create/edit Courses (`code`, `name`) as well as Weeks, Materials (title, description, optional external link, optional PDF metadata/upload <= 5 MB), Deadlines, and Announcements.

### Local-First Reads in Phase 1
- All UI hooks read from local Dexie tables via use cases (`ARCH-03`).
- On sign-in, class join, or course follow while online in Phase 1, repository/bootstrap methods hydrate Dexie with the user's class courses and followed course records so all screen reads remain strictly local IndexedDB queries.
- Seed data (`"Class A"`, `"Course A"`, `"Course B"`, `"Week 1"`, etc.) lives exclusively in `src/data/local/seed.ts` and never auto-populates production builds silently; expose an explicit `"Load sample seed data (Class A)"` action only in local demo/dev mode.

### Design Direction & Antislop (`during` mode)
- Governed by [DESIGN.md](file:///c:/Users/grego/OneDrive/Documents/sem%203/gabut/hacketon/DESIGN.md):
  - Crisp academic index-card style, `Dial: ENERGY 1 / RHYTHM 1 / MOTION 1`.
  - Light (`#F7F6F2` base, `#FFFFFF` card, `#142033` ink, `#1B3A6B` navy primary, `#9E331D` rust overdue/24h accent) and Dark (`#0F1724` base, `#172235` card, `#EDF1F7` ink, `#8AB4F8` primary, `#F59E8B` rust accent) themes with working toggle in `Settings` (and header quick-toggle).
  - System sans + system monospace fonts only; zero network font requests; zero external icon libraries (`Lucide` etc.); zero decorative emojis; zero em dashes (`\u2014`) in any copy, label, or comment (`R-02`).
  - Mobile-first at 360 px width, fluid `clamp()` type supporting 200% zoom, `>= 44px` tap targets with `>= 8px` gap, compact bottom nav on mobile (`Home`, `Courses`, `Settings`, plus `Manage` for `rep`) reflowing to top nav above `640px`.
  - Every data view implements explicit, actionable Empty, Loading, and Error states (`R-27`), native `<button>` / `<a href>` / `<label for>` semantics (`R-39`), `cursor: pointer` base rule, and visible `:focus-visible` outlines (`R-32`).

</decisions>

<specifics>
## Specific Acceptance & Verification Gates for Phase 1

- Vitest suite passes (`npm test` / `npx vitest run`) covering:
  - Architecture import boundaries (`ARCH-02`)
  - Domain rules (`isOverdue`, `isDueSoon`, `sortDeadlines`, `isAllowedCampusEmail`, `validateMaterialFile`)
  - Application use cases with fake in-memory repositories
- Production build succeeds (`npm run build`) with route-split chunks well under 200 KB gzipped.
- Every interactive control is verified end-to-end and recorded in the Milestone 1 Antislop Delivery Gate report (`R-35`).

</specifics>
