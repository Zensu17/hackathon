# Project State: LiteLearn

## Project Reference

See: [.planning/PROJECT.md](file:///c:/Users/grego/OneDrive/Documents/sem%203/gabut/hacketon/.planning/PROJECT.md) (updated 2026-11-04)

**Core value:** Dormitory students open followed courses, weekly materials, deadlines, and announcements offline on a 360 px phone in under 2 seconds without unexpected data usage.
**Current focus:** Phase 1 - Foundation and Core Screens (Milestone 1)

## Current Position

Phase: 1 of 3 (Foundation and Core Screens)
Plan: 3 of 3 completed (`01-01`, `01-02`, `01-03`)
Status: Milestone 1 Complete (Delivery Gate: PASS, ready for Milestone 2 / Phase 2)
Last activity: 2026-11-04 - Executed and verified Milestone 1 (`01-01`, `01-02`, `01-03`) with 48 passing tests, 46-step live Edge click-through, and `01-DELIVERY-GATE.md`

Progress: `[===.......] 33%`

## Locked Decisions & Context

- **Architecture:** Strict 4-layer Clean Architecture (`domain`, `application`, `data`, `presentation`), manual DI in `src/app/di.ts`, UI reads only from local Dexie IndexedDB via use cases.
- **Backend:** Supabase (Postgres, Auth, Storage, RLS).
- **Email domain rule:** Sign-up accepts `@students.del.ac.id` and `@del.ac.id` (with env variable override for local testing).
- **Onboarding & Roles:** Users after sign-in can Join Class (`student`) or Create Class (`rep`); `rep` users can also create Courses in their class. No admin panel.
- **File size limits:** Material PDF attachment max 5 MB; never auto-downloaded under default Data Saver ON; sub-1 MB PDFs for followed courses may sync when Data Saver is OFF.
- **Hosting:** Vercel static hosting.
- **Seed & Trial data:** Code seed data uses clearly fake names (`"Class A"`, `"Course A"`) in an isolated seed file only. Trial class, courses, and resident headcount remain `[TBD]` until Milestone 3 trial setup; never display unmeasured metrics as achieved.
- **Antislop & Design:** Active `during` mode governed by `DESIGN.md` (Crisp academic index-card style, Light + Dark theme toggle, navy `#1B3A6B` primary + rust `#9E331D` overdue/24h accent, system fonts, `Dial: ENERGY 1 / RHYTHM 1 / MOTION 1`).
- **Execution cadence:** Stop after each milestone/phase, run the Antislop Delivery Gate, summarize what was built, and provide manual test instructions.

## Blockers / Pending External Inputs

- Supabase project URL and anon key (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) will be needed in `.env` when testing live remote auth/sync against a real Supabase instance (local Dexie + fake repositories work offline without credentials during unit/local testing).
- Exact trial class name, 1 to 2 trial courses, and trial resident count (`[TBD]`) deferred until Milestone 3 trial preparation.

## Session Continuity

Last session: 2026-11-04
Stopped at: Completed Phase 1 (Milestone 1) execution and Delivery Gate sign-off
Next step: Run `/gsd-plan-phase 2` to plan Milestone 2 (Offline PWA, Delta Sync, Notes, and File Downloads)
