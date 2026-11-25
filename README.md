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
3. Run all five migrations in order inside the Supabase SQL Editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_nim_auth.sql`
   - `supabase/migrations/003_sync_and_rls_hardening.sql`
   - `supabase/migrations/004_security_and_sync_fixes.sql`
   - `supabase/migrations/005_roles_and_profile_customization.sql`
4. Verify connectivity and migrations with `npm run db:check`, and see [docs/SUPABASE-POSTGRES-SETUP.md](docs/SUPABASE-POSTGRES-SETUP.md) for the full Indonesian guide (including bootstrapping the first Class Rep and join code).
5. Deploy the static `dist/` build to Vercel (`vercel.json` is preconfigured for SPA rewrites and PWA cache headers).

## Known Limitations & Final Day Security Mitigation

- **Current pilot limits:** A NIM is not secret, so the class join code serves as the main guard against unauthorized class registration. There is no email-based password reset (passwords are reset manually by the team during the pilot). Any signed-in user can currently create a class and become its class representative (`rep`).
- **Planned Final Day mitigation (Section 5.4):** Class Access Control UI (verified coordinator class creation, one-tap join-code rotation/expiry, and member caps enforced by Postgres Row Level Security) plus top pilot usability fixes, alongside a `"What changed"` offline digest & visual Storage Manager (`navigator.storage.persist` and quota-full handling), and bulk weekly paste-import with co-editor invites.

## Material AI Assistance

- **Claude (Anthropic):** helped us draft and edit the abstract, design the survey questions, outline the pilot measures, draft the product requirement documents, and draft the semifinal proposal. The survey responses are real and were collected by the team. Claude did not provide any data or results.
- **Antigravity / Gemini (Google):** helped scaffold Clean Architecture modules, implement offline sync and security hardening fixes, run code reviews, and write Vitest unit and integration tests under the team's direction using our requirement documents (directed, reviewed, and verified by Gilbert Gultom and Albert Damian Sitorus).

Every member reviews the code and text, runs the tests, and can explain the design decisions.
