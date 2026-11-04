---
phase: 01-foundation-and-core-screens
plan: "02"
subsystem: application-data-and-di
tags:
  - clean-architecture
  - application-usecases
  - dexie
  - supabase-rls
  - dependency-injection
requires:
  - "01-01"
provides:
  - All 23 Phase 1 single-action application use cases, DTOs, and typed AppError
  - In-memory FakeRepositories and 4 Vitest application unit suites
  - LiteLearnDb Dexie IndexedDB schema, explicit row-to-domain mappers, and isolated fake sample seed module
  - Supabase Postgres 001_initial_schema.sql migration with atomic onboarding RPCs, 5 MB PDF bucket, and RLS on all 9 tables
  - Local-first Hybrid and Dexie repositories plus manual Clean Architecture composition root in src/app/di.ts
affects:
  - 01-03-PLAN.md
tech-stack:
  added: []
  patterns:
    - Single-action application use cases depending strictly on domain interfaces and pure rules
    - Local-first UI reads exclusively from Dexie IndexedDB tables (ARCH-03)
    - Online Supabase persistence with atomic local Dexie mirroring and zero-credential local SHA-256 fallback
    - Manual React context composition root encapsulating all src/data adapters inside src/app/di.ts
key-files:
  created:
    - .env.example
    - supabase/migrations/001_initial_schema.sql
    - src/application/errors/AppError.ts
    - src/application/dto/AuthDto.ts
    - src/application/dto/CourseDto.ts
    - src/application/dto/ContentDto.ts
    - src/application/dto/DeadlineDto.ts
    - src/application/dto/RepDto.ts
    - src/application/dto/index.ts
    - src/application/usecases/auth/SignUp.ts
    - src/application/usecases/auth/SignIn.ts
    - src/application/usecases/auth/SignOut.ts
    - src/application/usecases/auth/GetCurrentUser.ts
    - src/application/usecases/auth/JoinClass.ts
    - src/application/usecases/auth/CreateClass.ts
    - src/application/usecases/courses/ListCourses.ts
    - src/application/usecases/courses/FollowCourse.ts
    - src/application/usecases/courses/UnfollowCourse.ts
    - src/application/usecases/content/GetCourseWeeks.ts
    - src/application/usecases/content/GetMaterial.ts
    - src/application/usecases/deadlines/GetUpcomingDeadlines.ts
    - src/application/usecases/announcements/ListAnnouncements.ts
    - src/application/usecases/rep/CreateCourse.ts
    - src/application/usecases/rep/UpdateCourse.ts
    - src/application/usecases/rep/CreateWeek.ts
    - src/application/usecases/rep/UpdateWeek.ts
    - src/application/usecases/rep/CreateMaterial.ts
    - src/application/usecases/rep/UpdateMaterial.ts
    - src/application/usecases/rep/CreateDeadline.ts
    - src/application/usecases/rep/UpdateDeadline.ts
    - src/application/usecases/rep/CreateAnnouncement.ts
    - src/application/usecases/rep/UpdateAnnouncement.ts
    - src/application/usecases/index.ts
    - src/data/local/LiteLearnDb.ts
    - src/data/local/seed.ts
    - src/data/mappers/userMapper.ts
    - src/data/mappers/classMapper.ts
    - src/data/mappers/courseMapper.ts
    - src/data/mappers/contentMapper.ts
    - src/data/mappers/syncMapper.ts
    - src/data/remote/supabaseClient.ts
    - src/data/remote/SupabaseRemoteDataSource.ts
    - src/data/repositories/HybridAuthRepository.ts
    - src/data/repositories/HybridClassRepository.ts
    - src/data/repositories/HybridCourseRepository.ts
    - src/data/repositories/HybridWeekRepository.ts
    - src/data/repositories/HybridMaterialRepository.ts
    - src/data/repositories/HybridDeadlineRepository.ts
    - src/data/repositories/HybridAnnouncementRepository.ts
    - src/data/repositories/DexieNoteRepository.ts
    - src/data/repositories/DexieSyncQueueRepository.ts
    - src/app/di.ts
    - src/tests/application/fakes/FakeRepositories.ts
    - src/tests/application/authAndClass.test.ts
    - src/tests/application/coursesAndContent.test.ts
    - src/tests/application/deadlinesAndAnnouncements.test.ts
    - src/tests/application/repManagement.test.ts
  modified:
    - src/tests/architecture/boundaries.test.ts
key-decisions:
  - "Used TypeScript declare table properties on LiteLearnDb so useDefineForClassFields never shadows Dexie version(1).stores() bindings."
  - "Included a pure JS SHA-256 fallback beside Web Crypto subtle.digest in HybridAuthRepository so local fallback authentication works on plain HTTP LAN origins as well as localhost and HTTPS."
  - "Enforced both column-level UPDATE privilege revocation and an explicit WITH CHECK policy on public.profiles so authenticated clients cannot self-promote to rep outside SECURITY DEFINER onboarding RPCs."
  - "Guarded loadSampleSeedData in src/app/di.ts to throw FORBIDDEN_ROLE whenever Supabase credentials are active so fake Class A seed data can never run against a live backend."
duration: "25m"
completed: "2026-11-04"
status: complete
plan_head_before: "e1555b47343642e5074d25f5621cd88a20683ebd"
plan_head_after: "e304e18b61bd2504951565a957d98945f38f5666"
actuals:
  tokens: 56129
  tasks: 3
  commits: 3
---

# Phase 1 Plan 02: Application Use Cases, Local-First Data Layer, and DI Container Summary

All 23 Phase 1 Clean Architecture use cases, fake-repository Vitest suites, `LiteLearnDb` Dexie storage, explicit row-to-domain mappers, isolated `Class A` sample seed data, Supabase Postgres DDL with Row-Level Security across all 9 tables, local-first hybrid repositories, and the manual `src/app/di.ts` composition root.

## Tasks Completed

| Task | Description | Commit | Tests |
| --- | --- | --- | --- |
| 1 | Implement all 23 Phase 1 Application use cases, DTOs, `AppError`, and fake-repository Vitest suites | `9ccd605` | 41 passed |
| 2 | Implement `LiteLearnDb` Dexie schema, 5 explicit mapper modules, isolated fake `seed.ts`, `.env.example`, and `001_initial_schema.sql` | `2c50693` | 41 passed |
| 3 | Implement `SupabaseRemoteDataSource`, 9 local-first Hybrid/Dexie repositories, `src/app/di.ts`, and extended `boundaries.test.ts` | `e304e18` | 44 passed |

## Key Artifacts Built

`src/application/` provides `AppError`, typed DTOs, and 23 single-action use cases covering authentication (`SignUp`, `SignIn`, `SignOut`, `GetCurrentUser`), atomic class onboarding (`JoinClass`, `CreateClass`), course selection (`ListCourses`, `FollowCourse`, `UnfollowCourse`), study content (`GetCourseWeeks`, `GetMaterial`), urgency-annotated followed deadlines (`GetUpcomingDeadlines`), newest-first announcements (`ListAnnouncements`), and role-verified representative CRUD (`CreateCourse`, `UpdateCourse`, `CreateWeek`, `UpdateWeek`, `CreateMaterial`, `UpdateMaterial`, `CreateDeadline`, `UpdateDeadline`, `CreateAnnouncement`, `UpdateAnnouncement`).

`supabase/migrations/001_initial_schema.sql` and `.env.example` define the 9 Postgres tables (`classes`, `profiles`, `courses`, `course_follows`, `weeks`, `materials`, `deadlines`, `announcements`, `notes`), `updated_at` and foreign-key indexes, the `on_auth_user_created` profile trigger, `SECURITY DEFINER` RPCs `create_class_as_rep` and `join_class_by_code`, Row-Level Security on all 9 tables (restricting `notes` and `course_follows` strictly to `auth.uid()` and blocking direct `role` or `class_id` edits on `profiles`), and the private `materials` storage bucket limited to `5,242,880` bytes and `application/pdf`.

`src/data/` and `src/app/di.ts` wire `LiteLearnDb` (14 IndexedDB stores), explicit mappers with zero implicit object spread casts, isolated `seedSampleClassData` (`Class A`, `Course A`, `Course B`), `SupabaseRemoteDataSource` with storage path sanitization, 9 local-first repositories whose read methods query Dexie exclusively (`ARCH-03`), and `AppContainerProvider` / `useAppContainer()` exposing only use cases, `isLocalFallbackMode`, theme preference helpers, and guarded `loadSampleSeedData`.

## Verification Results

- `npm test`: 8 test suites passed, 44 tests passed (`emailRules.test.ts`: 7, `deadlineRules.test.ts`: 8, `fileRules.test.ts`: 6, `authAndClass.test.ts`: 7, `coursesAndContent.test.ts`: 3, `deadlinesAndAnnouncements.test.ts`: 3, `repManagement.test.ts`: 2, `boundaries.test.ts`: 8).
- `npm run build` (`tsc --noEmit && vite build`): succeeded with zero TypeScript or bundler errors (`dist/index.html` 0.34 kB gzip, `dist/assets/index-*.css` 1.84 kB gzip, `dist/assets/index-*.js` 46.23 kB gzip).
- Antislop copy and comment scan: 0 em dashes (`\u2014`), 0 en dashes (`\u2013`), 0 forbidden marketing buzzwords, and 0 decorative emojis across `.env.example`, `supabase/migrations/001_initial_schema.sql`, `src/`, and `01-02-SUMMARY.md`.

## Deviations from Plan

None - plan executed as specified.

## Known Stubs

None in files created or modified by Plan `01-02`. (`src/app/main.tsx` from Plan `01-01` awaits `AppContainerProvider` and `AppRouter` wiring in Plan `01-03`.)

## Self-Check: PASSED

- Verified all 58 created/modified files exist on disk and compile cleanly under `tsc --noEmit`.
- Verified commits `9ccd605`, `2c50693`, and `e304e18` are ancestors of `HEAD`.
