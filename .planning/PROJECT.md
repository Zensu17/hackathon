# LiteLearn

## What This Is

LiteLearn is a low-bandwidth, offline-first study assistant PWA built by Team ITD boys for STACK 2026 (GDGoC ITB, Case 1: Smarter Campus and Learning). It lets dormitory students open their course weeks, materials, deadlines, and announcements on a phone with no network signal, while letting class representatives enter and update course information offline or online through a minimal form.

## Core Value

A dormitory student can open their followed courses, weekly order, upcoming deadlines, and saved materials in under 2 seconds with zero signal, without burning mobile data on automatic downloads.

## Problem Context

About 300 students live in the IT Del dormitory and share one network that frequently drops or stalls ("connected but no internet"), especially in the evening. From the team's anonymous self-reported survey (44 respondents; perceptions rather than network measurements):

- 73% (32) often or almost daily have trouble opening e-learning due to the dorm network; 75% (33) report evenings are hardest.
- 93% (41) could not open materials when needed this semester, 48% (21) missed an announcement or schedule change, and 45% (20) submitted late.
- 66% (29) find pre-downloaded phone files hard to read, 50% (22) say files are scattered, and 45% (20) lose track of the weekly order.

## Target Users

- **Student (`student`, primary):** First- and second-year dorm resident studying mainly on a 360 px phone screen in the afternoon and evening. Needs offline access to weekly materials, deadlines, announcements, and private study notes.
- **Class Representative (`rep`, secondary):** Student who creates a class (receiving the `rep` role) and relays course weeks, materials, deadlines, and announcements to classmates via short offline-capable forms. There is no separate admin panel.

## Trial Scope (Planned, Not Yet Measured)

- **Trial group:** `[TBD]` dorm residents, 1 class (`[TBD]`), 1 to 2 courses (`[TBD]`), over 1 to 2 weeks.
- **Planned trial metrics:** Share of materials openable offline, missed deadlines before vs. during trial, and cold/warm offline home screen open time (target: under 2 seconds after first load). None of these metrics may be displayed in the UI or docs as already achieved.
- **Seed data rule:** Codebase seed data must remain clearly fake (for example `"Class A"`, `"Course A"`) and live strictly in a dedicated seed file.

## Mandatory Architecture & Constraints

- **Clean Architecture (non-negotiable):**
  - `Domain` (entities, repository interfaces, service interfaces, pure rules) depends on nothing external (no React, browser APIs, Dexie, or Supabase).
  - `Application` (single-action use cases, DTOs, sync orchestration) depends on `Domain` only.
  - `Data` (Dexie IndexedDB local store, Supabase remote store, repository implementations, mappers, network/sync services) implements `Domain` and `Application` interfaces.
  - `Presentation` (React pages, components, thin hooks, `labels.ts`, plain CSS/CSS modules) depends on `Application` and `Domain` types only, never importing `Data`.
  - Manual dependency injection wired in `src/app/di.ts` with explicit layer mappers.
- **Offline-first source of truth:** The UI reads exclusively from IndexedDB through use cases. Network calls occur only in auth/onboarding and the sync/file-download processes. Local writes while offline update IndexedDB and `SyncQueue` in the same transaction.
- **Low-bandwidth budget:** Initial JS bundle under 200 KB gzipped (route-level code splitting), system font stack only, compact delta JSON sync, exponential backoff on failure, and strict user-initiated PDF downloads (max 5 MB) except optional sub-1 MB auto-download when Data Saver is explicitly turned off.
- **Design & Anti-Slop Governance:** Active `during` mode governed by [DESIGN.md](file:///c:/Users/grego/OneDrive/Documents/sem%203/gabut/hacketon/DESIGN.md) (`ENERGY 1 / RHYTHM 1 / MOTION 1`, crisp academic index-card style, light/dark toggle, navy primary + rust urgency accent).

## Tech Stack

| Area | Choice |
|---|---|
| Language | TypeScript (`strict: true`) |
| UI & Routing | React + Vite + `react-router` (route-split) |
| Styling | Plain CSS / CSS Modules implementing `DESIGN.md` tokens (no UI component library) |
| PWA | `vite-plugin-pwa` (Workbox app-shell caching) |
| Local Storage | IndexedDB via `Dexie` |
| Backend | Supabase (Postgres, Auth, Storage, Row-Level Security) |
| Testing | Vitest (unit tests for `domain/` rules and `application/` use cases with fake in-memory repositories) |
| Hosting | Vercel static deployment |

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| Backend: Supabase | Provides Postgres delta queries (`updatedAt > lastSyncAt`), persistent Auth sessions, PDF Storage, and RLS for private notes and class/rep permissions | Confirmed |
| Campus email check on sign-up | Restrict sign-up to `@students.del.ac.id` and `@del.ac.id` (with an environment variable override for local/test accounts) | Confirmed |
| Class & Course onboarding | Users after sign-in can either Join Class via `joinCode` (`student`) or Create Class (`rep`); `rep` users can also create Courses in their class | Confirmed |
| Material PDF limit | Max 5 MB per PDF; never auto-downloaded by default; Data Saver OFF allows syncing files under 1 MB for followed courses | Confirmed |
| Hosting target | Vercel static hosting with SPA fallback rewrite and PWA asset headers | Confirmed |
| Visual direction | Crisp academic index-card style (`DESIGN.md`), light + dark theme toggle, navy `#1B3A6B` + rust `#9E331D` urgency accent, `Dial: 1/1/1` | Confirmed |
| Milestone execution | Stop after each of the 3 milestones, summarize what was built, run the Delivery Gate, and list exact verification steps | Confirmed |

---
*Last updated: 2026-11-04 after project initialization*
