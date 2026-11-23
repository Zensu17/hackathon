# LiteLearn

Low-bandwidth, offline-first study workspace PWA built by **Team ITD boys** (Institut Teknologi Del) for **STACK 2026 (GDGoC ITB, Case 1: Smarter Campus and Learning)**.

## Problem Statement

Around 300 dormitory students at IT Del share a campus network that frequently drops or stalls ("connected but no internet"), especially in the evening. From our anonymous survey of 44 dorm students (self-reported perceptions):

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

## Supabase Setup (Optional Live Cloud Sync)

1. Copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Run `supabase/migrations/001_initial_schema.sql` and `supabase/migrations/002_nim_auth.sql` in the Supabase SQL Editor.
3. Deploy the static `dist/` build to Vercel (`vercel.json` is preconfigured for SPA rewrites and PWA cache headers).
