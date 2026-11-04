# Phase 1 (Milestone 1) Antislop Delivery Gate Report

**Phase:** `01-foundation-and-core-screens`  
**Milestone:** Milestone 1 (Foundation and Core Screens)  
**Date:** 2026-11-04  
**Gate Verdict:** **PASS (0 FAIL items)**

---

## 1. Milestone 1 Summary

Milestone 1 delivers the complete 4-layer Clean Architecture foundation, local-first IndexedDB storage, Supabase Postgres + Row-Level Security schema, and all 8 Phase 1 student and class-representative screens for **LiteLearn**:

- **Domain Layer (`src/domain/`)**: 10 pure TypeScript entities (`User`, `Class`, `Course`, `CourseFollow`, `Week`, `Material`, `Deadline`, `Announcement`, `Note`, `SyncQueueItem`), 9 repository interfaces, 2 service interfaces, and 5 pure domain rule sets (`isAllowedCampusEmail`, `parseAllowedEmailDomains`, `isOverdue`, `isDueSoon`, `sortDeadlines`, `validateMaterialFile`, `formatByteSize`) with zero React, Dexie, Supabase, or browser API imports.
- **Application Layer (`src/application/`)**: 23 single-action use cases, typed DTOs, and `AppError` covering campus authentication (`SignUp`, `SignIn`, `SignOut`, `GetCurrentUser`), atomic class onboarding (`JoinClass`, `CreateClass`), course follow toggles (`ListCourses`, `FollowCourse`, `UnfollowCourse`), weekly materials (`GetCourseWeeks`, `GetMaterial`), urgency-annotated deadlines (`GetUpcomingDeadlines`), newest-first announcements (`ListAnnouncements`), and role-verified representative CRUD (`CreateCourse`, `UpdateCourse`, `CreateWeek`, `UpdateWeek`, `CreateMaterial`, `UpdateMaterial`, `CreateDeadline`, `UpdateDeadline`, `CreateAnnouncement`, `UpdateAnnouncement`).
- **Data Layer & Supabase Schema (`src/data/`, `supabase/migrations/001_initial_schema.sql`)**: `LiteLearnDb` Dexie IndexedDB database (14 stores), 5 explicit mapper modules with zero implicit object spreads, isolated fake sample seed module (`Class A`, `Course A`, `Course B`), 9 local-first repositories reading strictly from Dexie (`ARCH-03`), and complete Supabase SQL DDL with atomic onboarding RPCs (`create_class_as_rep`, `join_class_by_code`), private `materials` bucket (`<= 5,242,880` bytes, `application/pdf`), and Row-Level Security across all 9 tables.
- **Presentation Layer & Composition Root (`src/app/`, `src/presentation/`)**: Manual React Context composition root (`src/app/di.ts`), `React.lazy` per-route code splitting (`src/app/router.tsx`), centralized UI copy (`src/presentation/i18n/labels.ts`), `DESIGN.md` Light/Dark tokens (`tokens.css`, `base.css`, `AppLayout.css`, `pages.css`), 7 presentation hooks, `StateViews` (`EmptyState`, `LoadingState`, `ErrorState`), responsive `AppLayout` (`< 640px` fixed bottom nav, `>= 640px` top header bar), and all 8 Phase 1 pages (`SignInPage`, `JoinClassPage`, `HomePage`, `CoursesPage`, `CourseDetailPage`, `MaterialDetailPage`, `RepFormPage`, `SettingsPage`).
- **Automated Test Suite (`src/tests/`)**: 9 Vitest test files, **48 passing tests** covering domain rules, application use cases with in-memory fake repositories, Clean Architecture import boundaries, WCAG 2.x relative luminance contrast ratios (`>= 4.5:1` text, `>= 3.0:1` non-text), copy hygiene, and HTML shell semantics.

---

## 2. Measured Production Bundle Report (`QUAL-01`, `R-36`, `R-40`)

Measured from `npm run build` (`tsc --noEmit && vite build`) using `fs.readFileSync` and `zlib.gzipSync(buffer, { level: 9 })` on every emitted file in `dist/`:

| Emitted File | Role | Raw Size (Bytes) | Gzip Size (Bytes) | Gzip Size (KB, 1000-base) | Gzip Size (KiB, 1024-base) |
| --- | --- | ---: | ---: | ---: | ---: |
| `dist/index.html` | HTML5 app shell (`lang="en"`, zero blocking scripts) | 601 | 348 | 0.35 KB | 0.34 KiB |
| `dist/assets/index-CTT0YOr-.css` | Complete plain CSS tokens, base, layout, and pages | 16,372 | 3,208 | 3.21 KB | 3.13 KiB |
| `dist/assets/index-Cp6MXGTF.js` | **Initial entry JS bundle** (React, Router, Dexie, Supabase client, DI, AppLayout) | **594,157** | **173,304** | **173.30 KB** | **169.24 KiB** |
| `dist/assets/formatters-CXH9Cg_9.js` | Shared date/week formatter chunk | 760 | 403 | 0.40 KB | 0.39 KiB |
| `dist/assets/SignInPage-DExY1DJ4.js` | Lazy route `/signin` | 3,535 | 1,252 | 1.25 KB | 1.22 KiB |
| `dist/assets/JoinClassPage-CQOl5Rsy.js` | Lazy route `/join-class` | 4,713 | 1,284 | 1.28 KB | 1.25 KiB |
| `dist/assets/HomePage-D1VWEz_N.js` | Lazy route `/` (`Home`) | 2,701 | 1,129 | 1.13 KB | 1.10 KiB |
| `dist/assets/CoursesPage-CsePKPy5.js` | Lazy route `/courses` | 2,993 | 1,124 | 1.12 KB | 1.10 KiB |
| `dist/assets/CourseDetailPage-CbV3tH11.js` | Lazy route `/courses/:courseId` | 9,369 | 2,115 | 2.12 KB | 2.07 KiB |
| `dist/assets/MaterialDetailPage-BH0n6BcE.js` | Lazy route `/materials/:materialId` | 4,536 | 1,455 | 1.46 KB | 1.42 KiB |
| `dist/assets/RepFormPage-C0qYdy6D.js` | Lazy route `/manage` (Rep CRUD) | 19,301 | 4,643 | 4.64 KB | 4.53 KiB |
| `dist/assets/SettingsPage-DRdz-Mon.js` | Lazy route `/settings` | 3,394 | 993 | 0.99 KB | 0.97 KiB |

- **Budget Check (`QUAL-01`)**: Initial entry JS gzipped payload is **173,304 bytes** (`169.24 KiB` / `173.30 KB`), strictly under the **200 KB** (`204,800` bytes) ceiling by **31,496 bytes** (`30.76 KiB`), with zero web-font downloads (`0` bytes) and route-split page chunks averaging `1.0 KB` to `4.6 KB` gzipped.
- **Unmeasured Field Metrics Disclosure (`R-36`, `R-40`)**: Real-user Core Web Vitals (`LCP`, `INP`, `CLS` at p75) and dormitory trial usage metrics are **not measured (`[TBD]`)** in Milestone 1 and will only be recorded after real trial runs in Milestone 3.

---

## 3. Live Browser Click-Through Evidence (`R-35`)

Executed against the production build served by `vite preview --port 4173 --host 127.0.0.1` in headless **Microsoft Edge** (`playwright-core` driving `msedge.exe`) across `360x800` (mobile), `768x1024` (tablet), and `1280x800` (desktop), in both `light` and `dark` themes, plus `200%` root font zoom.

- **Console errors (`console.error`)**: `0`
- **Uncaught page exceptions (`pageerror`)**: `0`
- **Automatic PDF network requests**: `0`

| # | Screen & Interactive Element Exercised | Observed Behavior & Verification Result |
| ---: | --- | --- |
| 1 | Unauthenticated `/` redirect -> `/signin` | Redirected to `/signin` with `<h1>` `"Sign in to LiteLearn"`, landmarks (`header`, `main`, `footer`), 0 console errors. |
| 2 | Keyboard `Tab` -> `.skip-link` (`Skip to main content`) | Revealed `.skip-link` in viewport (`left: 12px`) with visible `2px solid` `:focus-visible` outline. |
| 3 | `SignIn` -> Submit empty form (`Sign in` button) | Rendered `role="alert"`: `"Enter your campus email and password to continue."` |
| 4 | `SignIn` Header -> `Dark` theme button | Switched `html[data-theme="dark"]` and passed `360x800` overflow, heading, cursor, and `>= 44px` target audit. |
| 5 | `SignIn` Header -> `Light` theme button | Switched `html[data-theme="light"]`. |
| 6 | `SignIn` -> `Create account` mode toggle button | Updated `aria-pressed="true"` and changed `<h1>` to `"Create student account"`. |
| 7 | `SignUp` -> Submit without `Full name` | Rendered `role="alert"`: `"Enter your full name to create an account."` |
| 8 | `SignUp` -> Submit `person@gmail.com` | Rejected non-campus domain with `role="alert"`: `"Use an IT Del email ending in @students.del.ac.id or @del.ac.id."` |
| 9 | `SignUp` -> Submit 5-character password | Rejected short password with `role="alert"`: `"Password must be at least 8 characters."` |
| 10 | `SignUp` -> Submit valid `rep01@students.del.ac.id` | Created account in IndexedDB and navigated to `/join-class`. |
| 11 | `JoinClass` -> Browser page reload (`AUTH-02`) | Restored authenticated session from IndexedDB with zero network dependency and stayed on `/join-class`. |
| 12 | `JoinClass` Header -> `Sign out` button | Cleared active session and redirected to `/signin`. |
| 13 | `SignIn` -> Sign in with `rep01@students.del.ac.id` | Authenticated existing user and navigated to `/join-class`. |
| 14 | `JoinClass` -> Submit unknown code `MISSING99` (`Join class with code`) | Rendered `role="alert"`: `"No class matched that join code. Check the code with your class representative and try again."` |
| 15 | `JoinClass` -> Submit empty class name (`Create class as representative`) | Rendered `role="alert"`: `"Enter a class name before creating a class."` |
| 16 | `JoinClass` -> Create class `D3 Teknologi Informasi 2026` (`IF-2026`) | Assigned `role="rep"`, displayed `Manage` link in mobile bottom nav, and navigated to `/`. |
| 17 | `Home` EmptyState #1 (0 followed courses) -> `Choose courses to follow` link | Navigated from `"No courses followed yet"` empty state to `/courses`. |
| 18 | `Courses` EmptyState -> `Create first course` link | Navigated from `"No courses in this class yet"` empty state to `/manage?type=course`. |
| 19 | `RepForm` (`Course`) -> Submit empty required fields (`Save course`) | Rendered `role="alert"`: `"Complete all required fields before saving."` |
| 20 | `RepForm` (`Course`) -> Save `IF1101` (`Discrete Mathematics`) | Created `IF1101`, auto-followed for `rep`, and navigated to `/courses/:courseId` showing followed zero-weeks `EmptyState`. |
| 21 | Bottom Nav -> `Home` (with 1 followed course, 0 deadlines) | Rendered distinct EmptyState #2: `"No deadlines posted yet"`. |
| 22 | `Courses` -> Click `Following` toggle button on `IF1101` | Unfollowed `IF1101` and updated button state to `aria-pressed="false"` (`"Follow course"`). |
| 23 | `Courses` -> Click `Open weeks` while `IF1101` is unfollowed | Opened `/courses/:courseId` rendering unfollowed `EmptyState` (`"Follow this course to store weekly content"`). |
| 24 | `CourseDetail` EmptyState -> Click `Follow course` primary button | Followed `IF1101` in IndexedDB and transitioned to followed zero-weeks `EmptyState` (`"No weeks posted for this course yet"`). |
| 25 | `CourseDetail` -> `Edit course` link -> `Save course` | Pre-filled `IF1101` fields via `?type=course&editId=...`, saved updated description, and returned to `CourseDetail`. |
| 26 | `CourseDetail` -> `Add first week` link -> `Save week` | Created `[WEEK 01]` (`Week 1: Propositional Logic`) card displaying explicit empty-week note. |
| 27 | `CourseDetail` -> `Edit week` link -> `Save week` (`UpdateWeek`) | Pre-filled Week 1 via `?type=week&courseId=...&editId=...`, updated summary, and rendered updated text on `CourseDetail`. |
| 28 | `RepForm` (`Material`) -> Select `> 5 MB` PDF (`5,244,928` bytes) | Rejected immediately with `role="alert"`: `"PDF exceeds the 5 MB limit. Compress or split the file first."` |
| 29 | `RepForm` (`Material`) -> Select non-PDF `.txt` file | Rejected immediately with `role="alert"`: `"Only PDF files (.pdf) up to 5 MB are accepted."` |
| 30 | `RepForm` (`Material`) -> Save valid `24,576`-byte PDF + external URL | Navigated to `/materials/:materialId` showing `"24.0 KB (24,576 bytes)"`, external link (`rel="noopener noreferrer"`), `"Offline PDF download coming in Milestone 2"` note, and `0` automatic PDF network requests. |
| 31 | `MaterialDetail` -> `Edit material` link -> `Save material` | Updated material title to `"Lecture 1 Handout and Exercises"` while preserving `24.0 KB` PDF metadata. |
| 32 | `MaterialDetail` -> `Back to IF1101` breadcrumb link | Navigated back to `/courses/:courseId` showing `[PDF 24.0 KB]` and `[External link]` tags under `[WEEK 01]`. |
| 33 | `RepForm` (`Deadline`) -> Save Week 1 deadline due in 6 hours | Rendered inside `[WEEK 01]` with rust `.index-card--urgent` styling and squared `Due within 24h` chip. |
| 34 | `RepForm` (`Deadline`) -> Save course-level (`weekId = null`) overdue deadline | Rendered dedicated `Course deadlines` index card on `CourseDetail` with rust border and squared `Overdue` chip. |
| 35 | `RepForm` (`Announcement`) -> Post 2 course notices | Rendered under `Course announcements` sorted newest-first (`postedAt` descending). |
| 36 | `Home` -> Click `weekId = null` deadline (`Syllabus Acknowledgement Form`) | Verified `Home` sorted overdue item first, navigated to `/courses/:courseId`, and surfaced it in `Course deadlines`. |
| 37 | `Home` -> Click week-assigned deadline (`Problem Set 1 Submission`) | Navigated to `/courses/:courseId` where the deadline is visible inside `[WEEK 01]`. |
| 38 | Responsive reflow -> `768x1024` and `1280x800` in Light + Dark modes | Reflowed fixed mobile bottom nav to static top header bar (`>= 640px`); verified `0` horizontal overflow and all targets `>= 44px`. |
| 39 | `Settings` -> `Dark` theme button + page reload | Activated `html[data-theme="dark"]` and persisted preference in IndexedDB `meta` store across browser reload. |
| 40 | `Settings` -> `Light` theme button | Restored `html[data-theme="light"]` across shell and cards. |
| 41 | `Settings` -> `Sign out` button | Signed out representative user and redirected to `/signin`. |
| 42 | Student user flow -> Sign up `student02@students.del.ac.id` & join `IF-2026` | Joined class via `joinCode` with `role="student"`; verified `Manage` link is omitted from navigation. |
| 43 | Student user flow -> Direct URL navigation to `/manage` -> `Return to Home` | Blocked student with `"Only class representatives can add or edit course content."` and navigated back to `/`. |
| 44 | Student user flow -> Follow `IF1101` on `/courses` -> Open `Home` | Surfaced class deadlines and urgent rust status chips on student `Home` directly from IndexedDB. |
| 45 | Local fallback helper -> `Load sample seed data (Class A)` on `/join-class` | Populated clearly labeled fake `Class A`, `Course A`, and `Course B` records (`ARCH-04`) and opened `/`. |
| 46 | Accessibility -> `200%` root font zoom at `360x800` across 6 screens (Light + Dark) | Verified `scrollWidth <= innerWidth` (`360 <= 360`), zero clipped text, `>= 44px` tap targets, and zero bottom-nav overlap when scrolled to page bottom. |

### Issues Caught & Fixed in Source During Task 3 Verification (`R-33`)

1. **Automatic `/favicon.ico` 404 console error in headless Edge**: Added `<link rel="icon" href="data:," />` directly in `index.html` so browsers neither issue a wasted `/favicon.ico` request on weak dorm Wi-Fi nor invent an unapproved logo icon (`R-23`), bringing `console.error` count to `0`.
2. **Initial-frame unhydrated state on `RepFormPage.tsx`**: Changed `isLoadingData` initial state from `false` to `true` directly in `src/presentation/pages/RepFormPage.tsx` and added `formatWeekOptionLabel` so `RepFormPage` renders `LoadingState` cleanly until Dexie hydration completes and never duplicates `"Week 1: Week 1: ..."` in `<select>` options.

---

## 4. Antislop Delivery Gate PASS/FAIL Report

### Block 1: Hard Gate (Absolute, All Answers Must Be "No")

- [x] **R-02 PASS (No)**: Zero em dashes (`\u2014`) and zero en dashes (`\u2013`) exist across `index.html`, `src/`, `supabase/`, `.env.example`, and Phase 1 planning docs (enforced automatically by `boundaries.test.ts` and `contrastAndCopy.test.ts`).
- [x] **R-03 PASS (No)**: Zero horizontal overflow (`scrollWidth === innerWidth` across `360x800`, `768x1024`, `1280x800`, and `200%` zoom), every interactive button/link/input measures `>= 44px x 44px` with `>= 8px` gap, and `<main>` reserves `calc(56px + 24px + env(safe-area-inset-bottom))` clearance above the mobile bottom bar.
- [x] **R-17 PASS (No)**: Zero unsourced statistics appear anywhere in the app; counts and file byte sizes come strictly from user/seed records in IndexedDB.
- [x] **R-18 PASS (No)**: Zero testimonials, avatars, or fictional reviews exist.
- [x] **R-23 PASS (No)**: Brand mark uses plain typographic `LiteLearn` wordmark per `DESIGN.md` (`<link rel="icon" href="data:," />` in HTML shell); zero unrequested logos, avatars, or fake realistic identities (`John Doe`) exist; sample seed uses explicit `Class A`, `Course A`, `Course B`, and `Sample Rep (Class A)` labels.
- [x] **R-24 PASS (No)**: Every navigation link (`Home` -> `/`, `Courses` -> `/courses`, `Manage` -> `/manage` for `rep`, `Settings` -> `/settings`) resolves to a working route.
- [x] **R-25 PASS (No)**: All 15 Light and Dark text/surface token pairs pass WCAG AA `>= 4.5:1` (`7.09:1` to `15.91:1` measured in `contrastAndCopy.test.ts`), and all 7 border/focus pairs pass WCAG 1.4.11 `>= 3.0:1` (`3.57:1` to `11.27:1`).
- [x] **R-26 PASS (No)**: Every button, link, toggle, and form performs real work backed by Dexie/use cases; `MaterialDetailPage` renders an honest plain-text status note (`Offline PDF download coming in Milestone 2`) rather than a dead or disabled download button.
- [x] **R-27 PASS (No)**: Every data view (`HomePage`, `CoursesPage`, `CourseDetailPage`, `MaterialDetailPage`, `RepFormPage`, `SettingsPage`) implements explicit `LoadingState`, `ErrorState` (with retry/navigation), and actionable `EmptyState` views (including unfollowed vs followed zero-weeks on `CourseDetailPage` and zero-followed vs zero-deadlines on `HomePage`).
- [x] **R-28 PASS (No)**: No FAQ section exists (`C-3`).
- [x] **R-32 PASS (No)**: Full keyboard traversal verified (`Tab` reveals `.skip-link`, `Enter`/`Space` activates native buttons and links, `2px solid var(--color-primary)` `:focus-visible` outline in Light and Dark themes, zero unreplaced `outline: none`).
- [x] **R-33 PASS (No)**: All styles, tokens, and components were authored and fixed directly in TypeScript/CSS source files; zero CSS/source string-replacement patch scripts exist.
- [x] **R-34 PASS (No)**: Both Light (`#F7F6F2` warm index-paper) and Dark (`#0F1724` deep-slate) themes are verified across all 8 screens and persist in IndexedDB.
- [x] **R-35 PASS (No)**: Production build ran under `vite preview` and all 46 interactive flows were clicked through in Microsoft Edge with 0 console/page errors and recorded in Section 3.
- [x] **R-36 PASS (No)**: Zero fabricated security, compliance, or performance claims; bundle bytes are measured from `dist/`, and unmeasured field metrics remain `[TBD]`.
- [x] **R-37 PASS (No)**: Built directly from `DESIGN.md` direction (`ENERGY 1 / RHYTHM 1 / MOTION 1`) with no slop conflicts.
- [x] **R-38 PASS (No)**: All form placeholders (`name@students.del.ac.id`, `IF1101`, `Discrete Mathematics`, `https://...`) and optional sample seed records (`Class A`, `Course A`) are transparently honest.
- [x] **R-39 PASS (No)**: Base CSS sets `cursor: pointer` on enabled controls and `cursor: not-allowed` on `:disabled`; all controls use native `<button>`, `<a href>`, `<input>`, `<select>`, `<textarea>` with explicit `<label htmlFor>`; `index.html` sets `<html lang="en">`, unique `<title>` per route, `<header>`/`<nav>`/`<main id="main-content">`/`:footer` landmarks, single `<h1>` per screen with zero skipped heading levels, zoom allowed, and `@media (prefers-reduced-motion: reduce)` honored.
- [x] **R-40 PASS (No)**: Zero unsized media elements, zero render-blocking third-party scripts in `<head>`, exact measured gzipped bundle bytes reported, and unmeasured Core Web Vitals explicitly marked not measured (`[TBD]`).

### Block 2: Purpose-Gate (Technique Allowed Only With Written Purpose, All Answers Must Be "No")

- [x] **R-01 PASS (No)**: Zero gradients, radial orbs, or neon glows exist; flat warm paper (`#F7F6F2`) and deep slate (`#0F1724`) surfaces maximize legibility on dim dormitory screens.
- [x] **R-04 PASS (No)**: Zero icon libraries, generic glyphs, or decorative emojis are used; text labels and monospace bracket tags (`[WEEK 01]`, `[PDF 24.0 KB]`) carry exact meaning at zero byte cost.
- [x] **R-06 PASS (No)**: System sans-serif (`system-ui`) eliminates font network transfers, while `ui-monospace` is restricted strictly to course codes, week tabs, join codes, timestamps, and file sizes per `DESIGN.md`.
- [x] **R-07 PASS (No)**: Zero decorative background grids, dots, or blueprint patterns exist.
- [x] **R-08 PASS (No)**: Zero decorative button arrows exist on CTAs.
- [x] **R-09 PASS (No)**: Squared `2px`-radius `.status-chip` tags appear only for real functional states (`Overdue`, `Due within 24h`, `Following`, `[PDF ...]`, `Local fallback mode`), never above `<h1>` as eyebrow decoration.
- [x] **R-10 PASS (No)**: Zero `backdrop-filter` or glassmorphism is used anywhere (`0` elements).
- [x] **R-12 PASS (No)**: Index cards use flat `1px solid var(--border-subtle)` boundaries (`box-shadow: none`); subtle `var(--shadow-chrome)` elevation is reserved solely for sticky/fixed navigation chrome per `DESIGN.md`.
- [x] **R-13 PASS (No)**: Zero decorative box or text glows exist (`0` elements).
- [x] **R-14 PASS (No)**: Cards vary structurally by content role: urgent deadline cards use rust border/surface + urgency chip, course cards pair metadata with follow toggles, and week cards organize nested material and deadline rows under a top-bordered `[WEEK NN]` rule.
- [x] **R-19 PASS (No)**: Motion strictly matches `MOTION 1` (instant state updates and `:hover`/`:active`/`:focus-visible` feedback only, zero entrance/loop animations).
- [x] **R-22 PASS (No)**: Zero generic illustrations exist.

### Block 3: Liveliness (All Answers Must Be "Yes")

- [x] **Dials set and explicit (`Yes`)**: `ENERGY 1 / RHYTHM 1 / MOTION 1` declared in `DESIGN.md` and `src/presentation/components/AppLayout.tsx`.
- [x] **Output consistent with claimed dials (`Yes`)**: Calm academic typography (`ENERGY 1`), predictable single-column scannable index stack (`RHYTHM 1`), and hover/focus-only state transitions (`MOTION 1`).
- [x] **One clear focal point per screen (`Yes`)**: `SignIn` -> campus auth card; `JoinClass` -> join-by-code vs create-class choice; `Home` -> sorted upcoming deadlines list; `Courses` -> class course follow toggle list; `CourseDetail` -> ordered `[WEEK 01..N]` index; `MaterialDetail` -> text summary + exact-byte attachment panel; `RepForm` -> minimal-field entity form; `Settings` -> Light/Dark appearance switch and class membership details.
- [x] **Structural whitespace (`Yes`)**: `4px/8px/12px/16px/24px/32px` token spacing separates header, index cards, and nested material/deadline rows cleanly across `360px`, `768px`, and `1280px`.
- [x] **One deliberate accent (`Yes`)**: Rust (`#9E331D` light / `#F59E8B` dark) appears strictly on overdue and due-within-24h deadlines and validation alerts, never diluted across generic chrome.
- [x] **Identity motif (`Yes`)**: Crisp top-bordered `.index-card` (`border-top: 2px solid var(--color-primary)`) with monospace `[WEEK 01]` / `[IF1101]` tab headers aligned to a `1px` rule repeats consistently across `Home`, `Courses`, `CourseDetail`, and `MaterialDetail`.
- [x] **Design Read declared before generation (`Yes`)**: Declared in `src/presentation/components/AppLayout.tsx`: `"Offline study index for dormitory students on mobile phones, in a crisp academic index-card style, dial ENERGY 1 / RHYTHM 1 / MOTION 1."`

### Block 4: Craftsmanship & Quality Locks (All Answers Must Be "No")

- [x] **C-1 Intentionality PASS (No)**: Every token, layout band, and copy label traces directly to dormitory low-bandwidth reading requirements in `DESIGN.md`.
- [x] **C-2 Functional Completeness PASS (No)**: Every interactive element across all 8 routes is wired to real application use cases and verified in headless Edge.
- [x] **C-3 Content-Driven Composition PASS (No)**: Zero marketing sections, hero banners, pricing tables, or filler blocks exist; every screen is an operational student/rep workspace view.
- [x] **C-4 Resilience PASS (No)**: Holds up across Empty/Loading/Error states, Light/Dark themes, `360px`/`768px`/`1280px` widths, `200%` text zoom, and keyboard-only navigation.
- [x] **C-5 Evidence Over Claims PASS (No)**: Every test count (`48`), contrast ratio, and gzipped byte size (`173,304` bytes) is verified by automated script execution.
- [x] **R-05 PASS (No)**: Workspace layout follows `RHYTHM 1` academic index-card hierarchy with zero marketing-template patterns.
- [x] **R-11 PASS (No)**: Deliberate border-radius hierarchy (`6px` cards, `4px` buttons/inputs, `2px` status chips; zero uniform pills).
- [x] **R-15 PASS (No)**: Specific, action-named CTAs (`Sign in`, `Create student account`, `Join class with code`, `Create class as representative`, `Choose courses to follow`, `Follow course`, `Open weeks`, `Add first week`, `Save material`); zero generic CTAs (`Get Started`, `Learn More`, `Try Now`, `Explore`, `Discover`).
- [x] **R-16 PASS (No)**: Zero AI marketing buzzwords (`contrastAndCopy.test.ts` scans all source files against `R-16` and Empty AI Vocabulary lists).
- [x] **R-20 PASS (No)**: Warm paper surface, academic navy top-bordered index cards, monospace `[WEEK 01]` tabs, and rust deadline chips establish a distinct course-binder character.
- [x] **R-21 PASS (No)**: Ships working Light and Dark modes respecting `prefers-color-scheme` on first visit with persistent toggles in both the header and `Settings`.
- [x] **R-29 PASS (No)**: Strict 2 core colors (`navy` + warm/slate surfaces) + 1 deliberate accent (`rust`) + neutrals.
- [x] **R-30 PASS (No)**: Purpose-built academic course binder layout; does not clone Linear, Vercel, Stripe, or Notion.
- [x] **R-31 PASS (No)**: One-line reasons recorded for every major visual decision:
  - *Palette*: Academic navy (`#1B3A6B` / `#8AB4F8`) anchors calm reading while rust (`#9E331D` / `#F59E8B`) is reserved strictly for overdue and due-within-24h deadlines so urgency stands out immediately.
  - *Typography*: System sans-serif downloads zero font bytes on weak dorm Wi-Fi, while system monospace distinguishes join codes, course codes, week tabs, and byte counts at a glance.
  - *Layout (`RHYTHM 1`)*: Single-column `760px` max-width index-card stacking lets students scan weeks, materials, and deadlines quickly on `360px` phones without horizontal scrolling.
  - *Spacing*: A compact `4px` to `32px` scale keeps `12px/16px` mobile padding tight enough for `360px` screens while expanding to `24px` at `>= 640px`.
  - *Cards & Borders*: Flat `1px` `3.6:1` borders with `2px` top accent rules replace soft drop shadows so card edges stay sharp on dim screens in both Light and Dark modes.
  - *Icons & Badges*: Plain text labels and squared `2px` status chips communicate exact state (`Overdue`, `Due within 24h`, `[PDF 24.0 KB]`) without icon-font bloat or color-only cues.

### Companion Skill Checklists

- [x] **UI Skill Checklist (`antislop-ui`)**: **PASS (16/16 Yes)** - `DESIGN.md` palette applied, rust accent reserved for urgency/errors, zero decorative emoji, `RHYTHM 1` and `MOTION 1` held, zero bento/terminal/stripe clichés, no pill above `<h1>`, all nav/controls functional, dose caps respected (`0` glass/glow, chrome-only shadow, `6px/4px/2px` radius), honest form placeholders, actionable Empty/Loading/Error states, verified across breakpoints/themes/keyboard, and exact bundle metrics measured.
- [x] **Human Skill Checklist (`antislop-human`)**: **PASS (7/7 Yes)** - All 15 text pairings verified `>= 4.5:1` and 7 boundary/focus pairings verified `>= 3.0:1` in `contrastAndCopy.test.ts`; high-contrast `2px` `:focus-visible` ring in both themes; full keyboard reachability with `.skip-link`; perceivable non-color-only Empty/Loading/Error and urgency chips; `200%` text zoom verified unclipped at `360x800`; native controls with `cursor: pointer`, visible `<label htmlFor>`, and `prefers-reduced-motion: reduce`.
- [x] **Layoutmobile Skill Checklist (`antislop-layoutmobile`)**: **PASS (10/10 Yes)** - Distinct mobile state (`< 640px` fixed bottom nav, stacked full-width form actions), intermediate tablet band (`>= 640px` static top nav, horizontal action rows, 2-column onboarding grid at `>= 768px`), desktop `760px` centered column (`>= 1024px`), fluid `clamp()` type scale, zero horizontal overflow, `>= 44x44px` targets with `>= 8px` gaps, `:active` tap feedback, and reserved bottom-nav scroll clearance verified at `360x800`.
- [x] **Copywriting Skill Checklist (`antislop-copywriting`)**: **PASS (10/10 Yes)** - Zero fabricated numbers/claims, zero `R-16` or Empty AI Vocabulary buzzwords, zero em/en dashes, zero scare-quote clusters or all-caps shouting, direct actor-named sentences in `labels.ts`, specific action CTAs, natural concise student/rep register.
- [x] **Code Comment Checklist (`antislop-code`)**: **PASS (10/10 Yes)** - Only concise `why`/boundary/Design Read comments retained; zero ASCII banners, zero obvious-line narration, zero vague `TODO`s, and zero decorative emoji.

---

## 5. Developer Manual Verification Instructions (Before Phase 2)

Run these steps locally to inspect Milestone 1 before starting Phase 2 (`02-offline-pwa-and-delta-sync`):

1. **Run automated unit, architecture, and WCAG contrast tests**:
   ```bash
   npm test
   ```
   Confirm all **9 test suites (48 tests)** pass.

2. **Build and preview the production bundle**:
   ```bash
   npm run build
   npm run preview -- --port 4173 --host 127.0.0.1
   ```
   Open `http://127.0.0.1:4173` in Chrome or Edge. (Without `.env` Supabase credentials, LiteLearn runs in **Local fallback mode** backed by IndexedDB; to test against live Supabase, copy `.env.example` to `.env`, apply `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor, and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.)

3. **Verify Class Representative onboarding and content creation**:
   - Click `Create account`, verify `person@gmail.com` is rejected, then register `rep01@students.del.ac.id` with an 8+ character password.
   - On `/join-class`, create class `D3 Teknologi Informasi 2026` with code `IF-2026`. Confirm `Manage` appears in the navigation bar.
   - Open `Courses` -> `Create first course` (`IF1101`, `Discrete Mathematics`), then add `Week 1`, upload a `<= 5 MB` PDF material (and confirm any `> 5 MB` PDF is rejected), add one Week 1 deadline due within 24 hours and one course-level (`Week (optional)` -> `Course-level deadline`) overdue deadline, and post an announcement.
   - Open `Home` and `CourseDetail` to confirm rust urgency styling + `Overdue` / `Due within 24h` chips, `[PDF <size>]` metadata with zero automatic PDF downloads, and newest-first announcements.

4. **Verify Student role guard, responsive layout, and Light/Dark themes**:
   - Open `Settings`, toggle `Dark` and `Light` modes, reload the page to confirm persistence, then click `Sign out`.
   - Create a second account (`student02@students.del.ac.id`), join `IF-2026` via `Join class with code`, confirm `Manage` is hidden in navigation, and visit `/manage` directly to verify the role permission guard.
   - In DevTools Device Mode (`360 x 800`), confirm the fixed bottom navigation never covers the bottom control on any page and keyboard `Tab` reveals `Skip to main content` and crisp focus outlines.
