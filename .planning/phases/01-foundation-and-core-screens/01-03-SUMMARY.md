---
phase: 01-foundation-and-core-screens
plan: "03"
subsystem: presentation-routing-and-delivery-gate
tags:
  - clean-architecture
  - react-router-lazy
  - wcag-aa-contrast
  - bundle-budget
  - antislop-delivery-gate
requires:
  - "01-01"
  - "01-02"
provides:
  - Route-split React Router shell and 7 local-first presentation hooks consuming AppContainer use cases exclusively
  - Accessible AppLayout (mobile fixed bottom nav and >= 640px top bar), StateViews, and all 8 Phase 1 student and rep screens
  - WCAG 2.x contrast, Antislop copy hygiene, and HTML shell semantics Vitest suite
  - Milestone 1 Antislop Delivery Gate report with measured < 200 KB gzipped bundle table and 46-step live Edge click-through log
affects:
  - Phase 2 (02-offline-pwa-and-delta-sync)
tech-stack:
  added: []
  patterns:
    - React.lazy per-route code splitting keeping initial entry JS at 173,304 bytes gzipped (< 200 KB budget)
    - Shared AuthSessionProvider and ThemeProvider contexts synchronizing local IndexedDB auth and Light/Dark state across route guards and chrome
    - Presentation components and hooks reading strictly from Dexie via useAppContainer() single-action use cases (ARCH-02, ARCH-03)
key-files:
  created:
    - src/app/router.tsx
    - src/presentation/hooks/useTheme.ts
    - src/presentation/hooks/useAuthSession.ts
    - src/presentation/hooks/useCourses.ts
    - src/presentation/hooks/useCourseDetail.ts
    - src/presentation/hooks/useMaterialDetail.ts
    - src/presentation/hooks/useUpcomingDeadlines.ts
    - src/presentation/hooks/useRepForms.ts
    - src/presentation/components/StateViews.tsx
    - src/presentation/components/AppLayout.tsx
    - src/presentation/components/AppLayout.css
    - src/presentation/styles/pages.css
    - src/presentation/utils/formatters.ts
    - src/presentation/pages/SignInPage.tsx
    - src/presentation/pages/JoinClassPage.tsx
    - src/presentation/pages/HomePage.tsx
    - src/presentation/pages/CoursesPage.tsx
    - src/presentation/pages/CourseDetailPage.tsx
    - src/presentation/pages/MaterialDetailPage.tsx
    - src/presentation/pages/RepFormPage.tsx
    - src/presentation/pages/SettingsPage.tsx
    - src/tests/architecture/contrastAndCopy.test.ts
    - .planning/phases/01-foundation-and-core-screens/01-DELIVERY-GATE.md
  modified:
    - index.html
    - src/app/main.tsx
    - src/presentation/i18n/labels.ts
    - src/application/usecases/auth/CreateClass.ts
    - src/tests/application/authAndClass.test.ts
key-decisions:
  - "Mounted ThemeProvider and AuthSessionProvider inside AppRouter so route guards, header quick-switch, and SettingsPage synchronize Light/Dark theme and session transitions immediately."
  - "Relaxed CreateClass join-code regex to /^[A-Z0-9][A-Z0-9-]{1,14}[A-Z0-9]$/ so hyphenated campus codes like IF-2026 work consistently across CreateClass, JoinClass, and Supabase SQL constraints."
  - "Added <link rel=\"icon\" href=\"data:,\" /> in index.html to suppress browser /favicon.ico 404 requests on weak dorm Wi-Fi without inventing an unrequested logo asset (R-23, R-35)."
duration: "36m"
completed: "2026-11-04"
status: complete
plan_head_before: "bf5d7cda9630149198d55fa30fd66d984c45ee82"
plan_head_after: "f95f258924d853471a8bfc901e9844cadcc02d72"
actuals:
  tokens: 52514
  tasks: 3
  commits: 3
---

# Phase 1 Plan 03: Presentation Shell, Core Student and Rep Screens, and Milestone 1 Delivery Gate Summary

Route-split React Router shell, 7 local-first presentation hooks, `DESIGN.md` Light/Dark `AppLayout`, all 8 Phase 1 student and class-representative screens (`SignIn`, `JoinClass`, `Home`, `Courses`, `CourseDetail`, `MaterialDetail`, `RepForm`, `Settings`), WCAG AA contrast and copy hygiene tests, and the Milestone 1 Antislop Delivery Gate report verified via a 46-step live Microsoft Edge click-through at `173,304` bytes (`169.24 KiB` / `173.30 KB`) initial gzipped JS.

## Tasks Completed

| Task | Description | Commit | Tests |
| --- | --- | --- | --- |
| 1 | Implement route-split router, 7 presentation hooks, `StateViews`, `AppLayout`, and `SignIn` / `JoinClass` / `Settings` screens | `df965a1` | 44 passed |
| 2 | Implement `Home`, `Courses`, `CourseDetail`, `MaterialDetail`, and `RepForm` screens with responsive `DESIGN.md` index-card styling | `a334dcb` | 44 passed |
| 3 | Verify WCAG contrast, `< 200 KB` gzipped bundle size, 46-step live Edge click-through across themes/viewports/zoom, and `01-DELIVERY-GATE.md` | `f95f258` | 48 passed |

## Key Artifacts Built

- **Routing, Composition & Hooks (`src/app/main.tsx`, `src/app/router.tsx`, `src/presentation/hooks/*`)**: Mounted `AppContainerProvider` + `AppRouter` using `React.lazy` for all 8 route modules with auth/class guards (`/signin`, `/join-class`, `/`, `/courses`, `/courses/:courseId`, `/materials/:materialId`, `/manage`, `/settings`), plus 7 hooks (`useTheme`, `useAuthSession`, `useCourses`, `useCourseDetail`, `useMaterialDetail`, `useUpcomingDeadlines`, `useRepForms`) that invoke `useAppContainer().usecases` exclusively without importing `src/data/`, `dexie`, or `@supabase/supabase-js`.
- **Shell & Reusable States (`src/presentation/components/AppLayout.tsx`, `AppLayout.css`, `StateViews.tsx`, `src/presentation/styles/pages.css`)**: Declared the `DESIGN.md` Design Read (`ENERGY 1 / RHYTHM 1 / MOTION 1`), keyboard `.skip-link`, `<header>`/`<nav>`/`<main id="main-content">`/`:footer` landmarks, Light/Dark quick-switch, `Local fallback mode` indicator, compact `< 640px` fixed bottom nav with reserved scroll clearance, `>= 640px` sticky top nav, and `EmptyState` / `LoadingState` / `ErrorState` components.
- **All 8 Phase 1 Screens (`src/presentation/pages/*`, `src/presentation/utils/formatters.ts`)**:
  - `SignInPage` & `JoinClassPage`: IT Del campus domain validation (`@students.del.ac.id`, `@del.ac.id`), local session persistence across reloads, join-by-code (`student`) vs create-class (`rep`), and optional local fallback `Class A` seed helper.
  - `HomePage` & `CoursesPage`: Urgency-sorted upcoming deadlines across followed courses with rust `.index-card--urgent` styling and squared `Overdue` / `Due within 24h` chips, two distinct `Home` empty states, and `>= 44px` course follow/unfollow toggles (`aria-pressed`).
  - `CourseDetailPage` & `MaterialDetailPage`: Unfollowed vs followed zero-weeks `EmptyState`, ordered `[WEEK 01..N]` index cards with `Edit week` links for `rep`, dedicated `Course deadlines` card for `weekId === null` items, newest-first `Course announcements`, exact byte size display (`24.0 KB (24,576 bytes)`), zero automatic PDF fetches, safe `http/https` external links, and honest `Offline PDF download coming in Milestone 2` status text.
  - `RepFormPage` & `SettingsPage`: Explicit student role guard (`Only class representatives can add or edit course content`), create/edit forms for `Course`, `Week`, `Material` (`<= 5 MB` PDF check), `Deadline`, and `Announcement`, persistent Light/Dark switch, profile/join-code card, and `Sign out`.
- **Automated Contrast/Copy Suite & Delivery Gate (`src/tests/architecture/contrastAndCopy.test.ts`, `01-DELIVERY-GATE.md`)**: Verified all 15 Light/Dark text pairs (`>= 4.5:1`) and 7 boundary/focus pairs (`>= 3.0:1`), enforced zero em/en dashes, buzzwords, generic CTAs, fake names, and emojis across `src/` and `index.html`, and recorded full Milestone 1 bundle + live Edge click-through evidence.

## Verification Results

- `npm test`: **9 test suites passed, 48 tests passed** (`emailRules.test.ts`: 7, `deadlineRules.test.ts`: 8, `fileRules.test.ts`: 6, `authAndClass.test.ts`: 7, `coursesAndContent.test.ts`: 3, `deadlinesAndAnnouncements.test.ts`: 3, `repManagement.test.ts`: 2, `boundaries.test.ts`: 8, `contrastAndCopy.test.ts`: 4).
- `npm run build` (`tsc --noEmit && vite build`): succeeded with zero TypeScript or bundler errors. Measured initial entry JS `dist/assets/index-Cp6MXGTF.js` is **594,157 bytes raw / 173,304 bytes gzipped (`169.24 KiB` / `173.30 KB`)**, strictly under the `200 KB` (`204,800` bytes) budget, with 8 lazy route chunks (`993` to `4,643` bytes gzipped) and plain CSS (`3,208` bytes gzipped).
- **Live Browser Click-Through (`R-35`)**: Executed 46 end-to-end steps against `vite preview` in headless Microsoft Edge across `360x800`, `768x1024`, and `1280x800` viewports, `light` and `dark` themes, `200%` root font zoom, keyboard `Tab` focus, rep CRUD + edit flows, student `/manage` role guard, and `Class A` seed loading with **0 console errors**, **0 page errors**, and **0 automatic PDF requests**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Allowed internal hyphens in `CreateClass` join-code validation**
- **Found during:** Task 1 (`JoinClassPage` + `01-03-PLAN.md` `IF-2026` specification)
- **Issue:** `CreateClass.ts` enforced `/^[A-Z0-9]{3,16}$/`, which rejected hyphenated class codes such as `IF-2026` required by the plan's onboarding flow even though `001_initial_schema.sql` permits 3-to-16 character uppercase codes.
- **Fix:** Updated `JOIN_CODE_PATTERN` in `src/application/usecases/auth/CreateClass.ts` to `/^[A-Z0-9][A-Z0-9-]{1,14}[A-Z0-9]$/` and added coverage in `src/tests/application/authAndClass.test.ts`.
- **Files modified:** `src/application/usecases/auth/CreateClass.ts`, `src/tests/application/authAndClass.test.ts`
- **Commit:** `df965a1`

**2. [Rule 1 - Bug] Eliminated `/favicon.ico` 404 console error and initial unhydrated frame on `RepFormPage`**
- **Found during:** Task 3 live Microsoft Edge click-through verification (`R-35`)
- **Issue:** Headless Edge logged a 404 console error for `/favicon.ico` when `<head>` had no icon link, and `RepFormPage.tsx` initialized `isLoadingData` to `false` (flashing unhydrated state for one frame on mount and duplicating `"Week 1: Week 1: ..."` when a week title already started with `Week 1`).
- **Fix:** Added `<link rel="icon" href="data:," />` in `index.html` (avoiding extra network requests without inventing an unapproved logo per `R-23`), initialized `isLoadingData` to `true`, and added `formatWeekOptionLabel` in `src/presentation/pages/RepFormPage.tsx`.
- **Files modified:** `index.html`, `src/presentation/pages/RepFormPage.tsx`
- **Commit:** `f95f258`

## Known Stubs

None. All 8 Phase 1 screens are wired end-to-end to IndexedDB via `AppContainerProvider` use cases (`src/app/main.tsx` placeholder from Plan `01-01` has been replaced). `MaterialDetailPage` displays an explicit plain-text note (`Offline PDF download coming in Milestone 2`) rather than a stub control (`R-26`).

## Self-Check: PASSED

- Verified all 28 created and modified files exist on disk and pass `npm test` (48/48) and `npm run build`.
- Verified zero em dashes (`\u2014`) and zero en dashes (`\u2013`) across `src/`, `index.html`, `01-DELIVERY-GATE.md`, and `01-03-SUMMARY.md`.
- Verified commits `df965a1`, `a334dcb`, and `f95f258` are ancestors of `HEAD`.
