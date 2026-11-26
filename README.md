# LiteLearn

Low-bandwidth, offline-first study workspace PWA built by **Team ITD boys** (Institut Teknologi Del) for **STACK 2026 (GDGoC ITB, Case 1: Smarter Campus and Learning)**.

**Live App:** https://hackathon-liart-delta.vercel.app/

## Problem Statement

Institut Teknologi Del (IT Del) houses ~1,600 students across 8 mandatory on-campus dormitory buildings (90–400 residents per hall) sharing campus dorm Wi-Fi that frequently drops or stalls ("connected but no internet"), especially in the evening. From our anonymous survey of 44 dorm students (self-reported perceptions):

- **73%** (32/44) often or almost daily have trouble opening e-learning due to dorm network instability.
- **93%** (41/44) could not open study materials when needed this semester.
- **48%** (21/44) missed an announcement or schedule change, and **45%** (20/44) submitted an assignment late.

## Core Architecture & Features

- **True Offline-First PWA (`vite-plugin-pwa` + Workbox)**: App shell and route chunks are precached for instant offline startup on 360 px mobile screens.
- **Strict 4-Layer Clean Architecture**:
  - `src/domain/`: Pure entities, repository/service interfaces, and business rules (`nimRules`, `deadlineRules`, `fileRules`, `syncRules`) with zero external or browser imports.
  - `src/application/`: 32 single-action use cases and DTOs depending only on `domain`.
  - `src/data/`: Dexie IndexedDB local store (source of truth for UI), Supabase remote data source, real-probe network detector, and exponential-backoff outbox sync engine.
  - `src/presentation/`: Route-split React UI implementing `DESIGN.md` tokens, Light/Dark/System themes, and WCAG AA contrast.
- **On-Demand PDF Caching & Data Saver**: PDFs (capped at 5 MB) display exact file sizes and never download automatically while Data Saver is ON. Downloaded PDFs persist in IndexedDB (`materialBlobs`) and open offline with zero network signal.
- **Private Study Notes**: Per-material private notes save locally in IndexedDB first and queue for sync; protected by Supabase Row-Level Security (`user_id = auth.uid()`).
- **Offline Global Search**: Instant local search across courses, materials, deadlines, and announcements without network requests.
- **Class Representative (`rep`) Workflow**: Create and update courses, weeks, materials, deadlines, and announcements online or offline through minimal forms queued atomically into `syncQueue`.

## Quick Start (Local Demo Mode)

```bash
npm install
npm run dev
```

Without Supabase credentials in `.env`, LiteLearn runs in **Local Demo Mode** using clearly labeled fake sample data (`Class A`, `CLASSA`) stored in IndexedDB:

| Role | NIM | Password |
|---|---|---|
| Student | `11S22001` | `password123` |
| Class Representative | `11S22002` | `password123` |

## Testing & Production Verification

```bash
npm test           # Vitest unit, architecture boundary, WCAG contrast, and copy hygiene suites
npm run typecheck  # TypeScript strict check
npm run build      # Production build + Workbox service worker + Web App Manifest
npm run preview    # Verify offline reload in DevTools > Application > Service Workers > Offline
```

## Supabase PostgreSQL Setup (Live Cloud Sync)

1. Copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (leave both blank to run in Local Demo Mode using IndexedDB only).
2. In Supabase Dashboard (**Authentication -> Providers -> Email**), turn **Confirm email** OFF (NIM auth maps to `<nim>@nim.litelearn.local`).
3. Run all seven migrations in order inside the Supabase SQL Editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_nim_auth.sql`
   - `supabase/migrations/003_sync_and_rls_hardening.sql`
   - `supabase/migrations/004_security_and_sync_fixes.sql`
   - `supabase/migrations/005_roles_and_profile_customization.sql`
   - `supabase/migrations/006_admin_user_management.sql`
   - `supabase/migrations/007_coordinator_class_creation_gate.sql`
4. Verify connectivity and migrations with `npm run db:check`, and see [docs/SUPABASE-POSTGRES-SETUP.md](docs/SUPABASE-POSTGRES-SETUP.md) for the full Indonesian guide (including bootstrapping the first Class Rep and join code).
5. Deploy the static `dist/` build to Vercel (`vercel.json` is preconfigured for SPA rewrites and PWA cache headers).

## Known Limitations & Final Day Security Mitigation

- **Implemented auth & offline sync protections:** `handle_new_auth_user()` derives NIM authoritatively from the auth identifier, enforces the IT Del NIM regex (`^[0-9]{2}[A-Z][0-9]{5}$`), and ignores spoofed client metadata; `check_class_join_code()` validates class join codes before account creation; self-registration is strictly `student`-only; `create_class_as_rep()` (`007_coordinator_class_creation_gate.sql`) restricts class creation to approved coordinators (`coordinator_allowlist` or Admin/Rep/Lecturer roles); Admin RPCs allow rapid account deactivation or reassignment if a NIM is squatted; `LiteLearnSyncService` calls `ensureFreshSession()` before pushing queued edits after prolonged offline periods and never drops `syncQueue` items on `401` or network failures; and `openOfflinePdfBlob()` includes an automatic `<a download>` fallback alongside `window.open()` for standalone PWA / iOS Safari compatibility.
- **Current pilot limits:** A NIM is not secret, so the class join code serves as the primary registration gate (no email-based password reset; passwords are reset by an Admin during the pilot). Physical testing so far is on Android Chrome; iOS Safari 7-day non-PWA storage eviction requires guiding iOS users to Add to Home Screen.
- **Pre-Final Day polish (7–15 Dec) & Final Day plan (Section 5.4):** Basic storage view, minimal paste-import, button-clip UI polish, and pilot fixes ship in 7–15 Dec; Final Day focuses on **co-editor invites** (committed) and **Class Access Control UI with join-code rotation/expiry & member caps** (committed), plus a `"What changed"` Home digest as an optional stretch goal.

## Material AI Assistance

All core engineering decisions and substantive deliverables were led and executed by the team: problem discovery and the 44-student dormitory survey (Zaki), 4-layer Clean Architecture design, PostgreSQL schema/RLS security rules, and sync hardening (Gilbert), React UI/UX, Dexie IndexedDB integration, Workbox PWA setup, and physical device debugging (Albert), plus manual integration and verification across the team.

- **Claude (Anthropic):** Assisted with English editorial polishing, structuring survey wording, and drafting/tightening sections of our product requirements and semifinal proposal text. All survey responses, Speedtest readings, and phone test results are real measurements collected by the team; Claude supplied no data or results.
- **Antigravity / Gemini (Google):** Assisted with boilerplate module scaffolding, initial Vitest test drafts, and code-review/linting checks based on our team-authored specifications. Every generated snippet was reviewed, debugged, modified where needed, and manually verified against the 126-test Vitest suite and physical devices by Gilbert Gultom and Albert Damian Sitorus.

Every member runs the local test suite, participates in internal architecture walkthroughs, and can explain the design decisions.
