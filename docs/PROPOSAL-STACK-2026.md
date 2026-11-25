# LiteLearn: A Low-Bandwidth Study Assistant for Students
**Semifinal Proposal  |  STACK 2026 by GDGoC ITB  |  Case 1: Smarter Campus and Learning**

---

## 1. Project and Team Identity

| Item | Detail |
|---|---|
| **Project title** | LiteLearn: A Low-Bandwidth Study Assistant for Students |
| **Team name** | ITD boys |
| **Selected case** | Case 1: Smarter Campus and Learning |
| **Project summary** | LiteLearn is an installable offline-first web app (PWA) for phones and laptops. It keeps a structured local copy of each followed course on the device—organized by week with written summaries, on-demand PDFs, cross-course deadlines, announcements, and private notes. It opens with zero signal and syncs incrementally when real internet connectivity returns. It complements—rather than replaces—the campus e-learning portal when dormitory connectivity fails. |
| **Repository & live demo** | https://github.com/Zensu17/hackathon \| Live app: https://hackathon-liart-delta.vercel.app/ (Local Demo Mode runs offline without cloud setup) |

| Member | Role | Responsible for |
|---|---|---|
| **Gilbert Gultom** (team leader) | System Architect, Backend & QA Lead | Clean Architecture design, Supabase Postgres schema & RLS migrations, sync/auth security hardening, automated testing (Vitest), and Vercel deployment |
| **Albert Damian Sitorus** | Frontend, UI/UX & Offline PWA Engineer | React UI & design system, NIM auth/profile screens, IndexedDB (Dexie) local store & sync integration, Workbox PWA shell, and mobile/laptop layouts |
| **Zaki Irfansyahputra Silalahi** | Product Research, QA & Pilot Coordinator | Dormitory user survey (`n = 44`), class-rep interviews, dorm network testing, two-phone & usability testing, class pilot coordination, and demo video |

---

## 2. Problem and User Analysis

### 2.1 Problem context
All Institut Teknologi Del (IT Del) students live in mandatory on-campus dormitories—8 buildings with ~1,600 total capacity (90–400 residents per hall) [2]—sharing dormitory Wi-Fi. During evening study hours, students experience severe slowdowns and frequent drops, including Wi-Fi staying **connected with no internet**, blocking access to campus e-learning (`ecourse.del.ac.id`) and course materials.

Downloading files ahead of time creates a second problem: loose, unindexed files on phones. Students struggle to tell which week a file belongs to or what is due next, while schedule updates arrive scattered across busy chat groups.

### 2.2 Target users
- **Primary users:** First- and second-year IT Del dormitory students studying primarily in the afternoon and evening; 29 of 44 (66%) use both phone and laptop equally.
- **Secondary users:** Class representatives (and authorized co-editors such as lecturers or teaching assistants) who publish weekly course updates.
- **Pilot scope:** One dormitory class (15–20 students, 2 courses) over 7 days on the real dormitory network.

### 2.3 What users need

| User need | Evidence from our survey (self-reported, `n = 44`) |
|---|---|
| Open course information when the network stalls | 32 of 44 (73%) often/almost daily struggle to open e-learning; 41 of 44 (93%) were blocked at least once this semester |
| Know what to study first and what is due next | 20 of 44 (45%) do not know the weekly order of downloaded files; 20 of 44 (45%) submitted an assignment late |
| Read comfortably on a phone | 29 of 44 (66%) find downloaded files hard to read on a phone |
| Track updates without digging through chat noise | 21 of 44 (48%) missed an announcement; 35 of 44 (80%) rely on WhatsApp groups for course info |
| Class representatives: one structured place to publish updates once | While 30% (13/44) explicitly name class reps as an info source, 80% (35/44) cite WhatsApp groups—where reps already post updates that quickly get buried in chat. In our rep interview (25 Nov `[FILL BEFORE SUBMIT: add "+ N additional reps interviewed on DD Nov" if conducted]`), reps noted that buried deadlines trigger repeated student questions and near-late submissions. |

*Table 1. User needs and supporting survey/interview evidence.*

### 2.4 Supporting evidence
We conducted an anonymous survey of 44 IT Del dormitory students (23–28 Oct 2026) via class WhatsApp groups and direct messages; 40 entered in 2025–2026. Responses are self-reported perceptions, not instrumented network logs [1].

| Finding (self-reported) | Respondents | Share |
|---|---|---|
| Often or almost daily have trouble opening e-learning due to dorm network | 32 of 44 | 73% |
| Name evening study hours (17.00–22.00) as the hardest access window | 33 of 44 | 75% |
| Could not open study materials when needed this semester | 41 of 44 | 93% |
| Missed an announcement or schedule change | 21 of 44 | 48% |
| Submitted an assignment late | 20 of 44 | 45% |
| Find downloaded files hard to read on a phone | 29 of 44 | 66% |
| Say downloaded files are scattered and hard to find | 22 of 44 | 50% |
| Do not know the weekly order of downloaded materials | 20 of 44 | 45% |

*Table 2. Survey results (`n = 44`).*

Three-quarters of respondents (75%) identify 17.00–22.00 as the worst connectivity window, with open comments repeatedly citing Wi-Fi remaining "connected, no internet" during evening study.

**Network measurements & limits of evidence.** Our survey uses a small convenience sample (`n = 44`) with self-reported items. To complement it with direct observations on 25 Nov 2026:
- **Off-peak dorm Wi-Fi (daytime baseline):** Three Speedtests measured 1.57–4.72 Mb/s down, 4.54–6.18 Mb/s up, and 48–97 ms ping—usable for daytime prefetching.
- **Peak evening dorm Wi-Fi (19:00–21:00):** `[FILL BEFORE SUBMIT: Insert 3 real evening dorm Wi-Fi Speedtest measurements taken 19:00–21:00 — e.g., X.XX–X.XX Mb/s down, XXX ms ping / timeout / "Connected, no internet" observation]`
- **Peak evening 4G cellular fallback inside dorm (18:59–19:07, two phones):** Three checks measured 0.09–0.52 Mb/s down on Ookla (61–243 ms idle / 71–391 ms loaded ping) and 1.70 Mb/s down / 2.14 Mb/s up on Google Speed Test—confirming that cellular fallback also degrades sharply indoors at night.

Multi-evening dorm Wi-Fi logging continues throughout the 1–7 Dec pilot.

### 2.5 Existing alternatives

| What students do now | Survey share | Why it still falls short in dorm conditions | How LiteLearn differs |
|---|---|---|---|
| Campus e-learning web (Moodle [3]) | 22/44 (50%) | Requires live connectivity; fails during evening dorm drops and "connected, no internet" stalls (Table 2). | Keeps a structured on-device copy in IndexedDB that opens with zero signal. |
| Official Moodle Mobile app | Not asked separately | Direct test on 25 Nov 2026 failed/rejected connection to `ecourse.del.ac.id` (campus Moodle Mobile Web Services are disabled by IT) [3]. | Zero-IT-dependency companion PWA with cross-course deadline triage and offline reading. |
| Download files manually to phone | 16/44 (36%) | Files end up scattered across Downloads with no weekly order, no deadline links, and poor mobile readability (Table 2). | Organizes content by course and week; text loads instantly, PDFs download only on tap. |
| WhatsApp groups (incl. Pinned Messages & Communities/Announcements) | 35/44 (80%); friends 31/44 (70%) | Even with **Pinned Messages** (capped at 3 pins per chat) or **WhatsApp Communities/Announcement groups**, updates remain a flat chronological stream across all courses with no weekly syllabus index, no personal deadline checklist, and no side-by-side notes. Uncached attachments/media and older chat archives still fail to load when dorm Wi-Fi stalls. | Dedicated per-course weekly index + cross-course deadline checklist + private notes cached locally in IndexedDB, readable in airplane mode. |
| Wait or relocate for better signal | 31/44 (70%) wait; 23/44 (52%) move | Wastes evening study time during the busiest assignment window. | Reading, searching, and note-taking never depend on live signal. |
| Cloud tools (Google Classroom, Drive, Notion) | Not adopted for dorm offline study | Classroom requires lecturer migration; **Google Drive offline** requires manual per-file offline toggles and provides raw folders without weekly study outlines, deadlines, or announcements; Notion requires heavy web loads and unreliable mobile offline caching. | Lightweight installable PWA (`154 KB` base gzip JS), class-rep driven, structured by course, week, and due date offline. |

*Table 3. Current practices and how LiteLearn differs.*

---

## 3. Proposed Solution

### 3.1 Value offered
- **For students:** Open weekly course outlines, deadlines, announcements, and private notes with zero signal; see immediately what is due next across all followed courses; and choose explicitly before downloading any PDF (exact size shown upfront).
- **For class representatives (single-entry, not double-entry):** Instead of repeatedly reposting schedules and answering "when is this due?" in WhatsApp, reps enter a weekly update **once** in LiteLearn (offline in the dorm or on daytime campus Wi-Fi) and share a single short pointer/summary in the class WhatsApp group. Role-gated multi-editor access (`rep`, `lecturer`, `assistant`) is already enforced at the database layer so workload can be shared, with bulk paste-import and co-editor invites shipping on Final Day (5.4).
- **Value even under strict slide copyright:** Because LiteLearn is **text-first**, courses where lecturers prohibit re-uploading original slide PDFs still deliver core offline value—structured weekly topic outlines, key-concept summaries, exact deadlines/submission rules, schedule announcements, daytime reference links, and per-material private notes. When lecturers permit internal class PDFs (as confirmed by our pilot lecturer on 25 Nov), PDFs cache on demand (`≤5 MB`).
- **For the campus:** A zero-IT-dependency companion whose anonymized pilot metrics can inform campus IT without modifying `ecourse.del.ac.id`.

### 3.2 Scope of the first version
- **Included:** One dorm class (1–2 pilot courses); NIM/password sign-in; course follow; weekly course view (text summaries, links, or `≤5 MB` PDFs); cross-course deadlines & completion checklist; announcements; offline quick search; per-material private notes; offline mode with real-probe auto-sync; and rep/co-editor CRUD forms.
- **Excluded:** Official LMS API integration, AI features, chat/forums, video hosting, push notifications, or institution-wide ERP dashboards.

### 3.3 Main user journey
**Student**
1. Sign up with NIM, display name, password, and the class join code shared by the class rep.
2. Follow active courses so their weekly metadata caches locally on sync.
3. Open **Home** to see the next urgent deadline, followed courses, and recent announcements, then drill into any course week by week.
4. Study offline: read text summaries, open previously cached PDFs, save private notes, and check off completed deadlines.
5. When real internet returns, queued notes and follow states sync automatically while incremental updates pull down.

**Class representative / co-editor**
1. Set up class courses once and share the join code.
2. Post weeks, summaries/materials, deadlines, and announcements through one compact offline-capable form, then drop one concise notice in the class WhatsApp group pointing peers to the updated week.

`[FILL BEFORE SUBMIT: Insert updated Figure 1 (3 mobile screenshots from the latest build with English demo data and no desktop Ctrl K badge on mobile)]`

**Figure 1.** LiteLearn mobile prototype (Local Demo Mode, English demo dataset): (a) Home & next deadline triage, (b) weekly course index, and (c) material detail with pre-download PDF byte-size gate.

### 3.4 Case alignment and originality
**Case alignment.** Case 1 asks how to make learning materials easier to reach with a clear user journey (3.3), working core interaction (offline reading + background sync), and measurable impact. LiteLearn targets dormitory students on congested shared Wi-Fi and verifies offline availability, airplane-mode deadline lookup speed, cold-start latency, and rep maintenance time (Table 8).

**Engineering and workflow differentiation.** Rather than building another generic LMS clone, LiteLearn combines five design decisions engineered specifically for "connected, no internet" student dormitories:
1. **Active network-probe sync gate:** A lightweight `HEAD` reachability probe (`>3 s` latency or `5xx`/timeout → `Slow`/`Offline`) prevents the app from hanging when dorm Wi-Fi stays connected without internet, unlike standard apps that trust `navigator.onLine`.
2. **Strict low-bandwidth architecture:** `154 KB` gzip base JS with **lazy-loaded cloud SDK** (the `59.4 KB` gzip Supabase client never downloads in offline/local mode) and Data Saver ON by default, gating every PDF behind an explicit size display.
3. **Zero-IT-dependency peer-maintained offline cache:** Works today even though `ecourse.del.ac.id` blocks Moodle Mobile Web Services, unifying cross-course deadline triage, weekly study outlines, and private notes in one local IndexedDB store.
4. **Single-entry rep workflow with shared ownership:** Replaces repetitive chat reposts with one structured weekly entry; database RLS already supports multiple class editors (`rep`, `lecturer`, `assistant`).
5. **Low-friction ingestion roadmap:** A **paste-to-structured-week parser** (converting pasted WhatsApp/syllabus text into structured weekly items and deadlines offline) ships on Final Day (5.4) to cut rep entry effort under 5 min/week.

---

## 4. Technical Design

### 4.1 Architecture and system flow
LiteLearn enforces a four-layer Clean Architecture (`Presentation → Application → Domain ← Data`); automated boundary tests verify that `domain` and `application` never import React, Dexie, or Supabase. A Workbox Service Worker precaches the app shell (`34` assets, `981.20 KiB`) for instant offline launch, and **IndexedDB (via Dexie)** is the sole local source of truth—UI screens never block on network requests.

Data moves between the device and Supabase across five reliability mechanisms:
1. **Offline Read & Atomic Local Write:** Every view, search, deadline check, private note, or rep edit reads/writes IndexedDB first and appends an operation to a user-scoped `syncQueue` outbox.
2. **Adaptive Real-Probe Sync & Delta Pull:** A `HEAD` probe (`5 s` timeout, `>3 s` or `5xx` marked `Slow`) defers cloud traffic when Wi-Fi stalls. When truly online, queued outbox items push sequentially with exponential retry backoff, followed by cursor-based incremental pulls (`updated_at > last_sync_cursor`, text JSON only—no PDF binaries).
3. **Prolonged-Offline Session & JWT Refresh Safety:** Supabase access JWTs expire after 1 hour, while refresh tokens persist locally (`persistSession: true`, `autoRefreshToken: true`). Before pushing the outbox on reconnect after 1–2 days offline, `LiteLearnSyncService` calls `ensureFreshSession()` to inspect `expires_at` and refresh the JWT proactively via `auth.refreshSession()`. Crucially, if refresh or upload fails with `401 Unauthorized`, `syncNow()` aborts cleanly without deleting any queued items—edits remain safely persisted in `syncQueue` (verified by Vitest) until the user re-authenticates.
4. **Conflict Resolution (Pilot & Final Day Co-Editors):** Private notes use timestamp-based Last-Write-Wins (LWW) enforced both client-side (pending outbox items are protected via `pendingEntityKeys` during delta pulls) and server-side via Postgres trigger `trg_notes_lww`. During the initial pilot, one primary rep edits each course. For **Final Day multi-editor support (5.4)**, shared course entities use **entity-level optimistic concurrency** (comparing each row's `updated_at` / version token on update): edits to distinct items (e.g., Co-Editor A adds a Week 4 material while Co-Editor B adds a deadline) merge cleanly with zero conflict, while simultaneous offline edits to the exact same row surface a non-destructive conflict prompt instead of silently overwriting.
5. **On-Demand PDFs:** PDFs cap at `5 MB`, validate `%PDF-` magic bytes, and download only on tap while Data Saver is ON (default). Files under `1 MB` prefetch only if the user disables Data Saver.

*(Insert **Figure 2** here — architecture diagram.)*

**Figure 2.** LiteLearn offline-first Clean Architecture, local IndexedDB source of truth, real-probe background sync (push outbox + delta pull), and on-demand PDF caching flow.

### 4.2 Technologies

| Area | Technology | Reason |
|---|---|---|
| Front end | React, TypeScript, Vite, React Router | Productive, type-safe stack with route-level code splitting |
| Offline data | IndexedDB via Dexie | Structured, high-capacity local storage with zero-signal reads/writes |
| Offline app shell | Service Worker via Workbox (`vite-plugin-pwa`) | Reliable precaching (`34` entries) for offline startup and PWA installation |
| Backend | Supabase (Auth, Postgres + RLS, Storage) | Managed backend with row-level authorization; zero custom servers |
| Hosting | Vercel (static HTTPS site) | Fast global CDN with SPA rewrites and PWA cache headers |
| Testing | Vitest | Fast unit, sync-resilience, contrast/copy, and architecture-boundary tests |

*Table 4. Technology choices. AI is not part of the runtime product.*

### 4.3 Data sources, data model, and performance
All course content is entered by authorized class reps/co-editors (no external scraper or unauthorized LMS dependency); English demo data ("Class A") lives in one isolated seed module. Core entities cover classes, courses, follows, weeks, materials, material blobs, deadlines, deadline completions, announcements, private notes, and queued sync operations.

**Measured performance budgets:**
- **Initial JS budget (`<200 KB` gzip):** After replacing the animation library with pure CSS and verifying the production build (`vite build`), base JS measures **154.05 KB gzip** (`vendor-react` 60.28 KB + `index` 51.37 KB + `vendor-dexie` 32.61 KB + `vendor-sonner` 9.79 KB), or ~**161.4 KB gzip** including the lazy Home route—nearly 39–46 KB under budget; `vendor-supabase` (**59.40 KB gzip**) loads lazily only during online cloud sync.
- **Offline cold-start (`<2 s`):** Measured at **154 ms** in headless Chrome emulation and **1.5–2.0 s** cold start in airplane mode on physical mid-range Android phones (Redmi 12 & Redmi Note 12).
- **Delta sync payload (`<20 KB` target):** Incremental pulls transmit only JSON metadata rows modified after `last_sync_cursor` (zero PDF binaries). `[FILL BEFORE SUBMIT: Insert measured DevTools Network transfer size for a typical 1-week incremental delta pull — e.g., X.X KB gzip / X.X KB uncompressed — verified on DD Nov 2026.]`

### 4.4 Feasibility check & platform limits

| Concern | Why it is manageable & known boundaries | Status |
|---|---|---|
| Scope for time available | Single class, 1–2 courses, zero LMS IT dependency; all core flows are built and tested (Table 6). | Verified on 2 Android phones; 126 Vitest passed |
| Device storage & **iOS/Safari limits** | Text metadata is minimal; PDFs cap at `5 MB` on tap (~110 MB rough estimate for 4 courses × 14 weeks × two 1 MB PDFs). On **iOS Safari**, WebKit can evict script-writable storage after 7 days of inactivity in non-installed browser tabs; mitigation is guiding iOS users to **Add to Home Screen** (standalone PWA storage exemption) plus calling `navigator.storage.persist()` in 5.4. Because standalone iOS PWAs can restrict `window.open(blobUrl)` for PDFs, `openOfflinePdfBlob()` already includes an automatic `<a download>` fallback. Physical testing so far is Android Chrome; iOS Safari verification is scheduled before wider rollout. | Fallback implemented; Storage Manager & iOS check planned |
| Weak / stalled dorm Wi-Fi | Reading never touches the network; real `HEAD` probe defers sync on `>3 s` / `5xx`; `ensureFreshSession()` + outbox retain edits across `401` or drops. | Tested in airplane mode & Vitest; dorm pilot 1–7 Dec |
| Cost | Vercel Hobby free tier (static HTTPS, 100 GB/month) + Supabase Free tier (500 MB Postgres, 1 GB storage, 50K MAU, 5 GB egress/month) = **\$0/month** for a single-class pilot. | Confirmed (\$0/month free tiers) |
| Team skills | Every member owns a distinct subsystem (backend/RLS/tests, frontend/Dexie/PWA, research/QA/pilot), runs the 126-test Vitest suite locally, and can walk through and modify core modules. | Confirmed across team |

*Table 5. Feasibility check and platform boundaries. Estimates are explicitly labeled.*

---

## 5. Development Plan

### 5.1 Current progress
Every feature uses one of three strictly defined statuses (matching our demo video): **Tested on a phone** (verified on physical hardware with date and device), **Built, automated tests passed**, or **Not built yet**.

| Feature | Status | Evidence |
|---|---|---|
| NIM + password + class-code sign-up/sign-in | Tested on a phone | Session persisted offline; pre-signup join-code check + Vitest passed |
| Course catalog, follow & unfollow | Tested on a phone | Follow state synced to Home & local cache; Vitest passed |
| Weekly course view: materials, deadlines, announcements | Tested on a phone | Opened cleanly in airplane mode; Vitest passed |
| Class rep & multi-role CRUD forms (create, edit, delete) | Tested on a phone | Offline edits queued in Manage tab (Fig. 3c); RLS & Vitest passed |
| Installable offline PWA shell | Tested on a phone | Installed PWA reopened offline (Fig. 3a–b); 34 precached assets; 1.5–2.0 s cold start |
| Outbox sync, cursor delta pull, JWT refresh guard & status badge | Tested on a phone | Offline edits synced on reconnect; `ensureFreshSession()` + `401` preservation verified by Vitest |
| Private notes; on-demand PDF download; Data Saver | Tested on a phone | Note auto-saved & synced; `411 KB` & `310.5 KB` PDFs opened offline (Fig. 3) |
| Offline quick search & deadline completion checklist | Tested on a phone | Instant local search & checkmarks persisted offline; Vitest passed |
| Visual Storage Manager, `storage.persist()` & quota-full UI | Not built yet | Planned, Task 2 in 5.4 (basic PDF stats/clear live in Settings) |
| Laptop layout with side navigation | Built, automated tests passed | Desktop sidebar (`≥1024 px`) checked in desktop browser (24 Nov) |
| Full 7-day dormitory class pilot | Not built yet | Scheduled 1–7 Dec (6.1) |

*Table 6. Feature status. Automated suite: **126 passing Vitest tests (21 files)**.*

**How we test & latest-build verification.** Automated tests (126 Vitest cases across 21 files) verify domain rules, sync queue coalescing/backoff, prolonged-offline JWT refresh & `401` outbox preservation, WCAG contrast/copy hygiene, and Clean Architecture boundaries on the latest build. On 25 Nov, we fixed the narrow-screen `Open PDF offline` button clipping (`height: auto` + full-width stacking under `479 px`), hid desktop keyboard hints (`Ctrl K` / `Ctrl+S`) on mobile/touch viewports, and translated all demo seed courses/labels to English. `[FILL BEFORE SUBMIT: Re-verify all 8 core flows on the latest live Vercel build on Redmi Note 12 & Redmi 12 on DD Nov 2026 and confirm zero regressions.]`

`[FILL BEFORE SUBMIT: Insert updated Figure 3 screenshots taken on the latest build showing unclipped Open PDF offline button, no Ctrl+S hint on mobile, and 100% English demo data]`

**Figure 3.** Physical phone airplane-mode verification on the latest build (`[DD Nov 2026]`): (a–b) standalone PWA on Redmi 12 (ZS) & Redmi Note 12 (AS) with cached offline PDF and auto-saving private notes; (c) Class Rep Manage tab on live Vercel deployment in airplane mode.

### 5.2 Milestones

| Dates | Milestone & owner | Done when |
|---|---|---|
| 24–26 Nov | Two-phone tests, UI polish (`Open PDF` wrap & mobile shortcut hints), evening Wi-Fi checks, & full 8-flow regression. **Owners:** Albert & Zaki | Latest live build passes all 8 flows on 2 phones; refreshed Figures 1 & 3 captured |
| 26–28 Nov | Pre-submission usability check (`n = 5–8` non-team dorm peers), DevTools delta-sync measurement, video, proposal, & signed declaration. **Owners:** Full team | Early usability metrics & delta-sync KB recorded; `<2 min` video, `≤10`-page PDF, & signed declaration ready |
| 30 Nov (morning) | Submit proposal & demo video. **Owner:** Gilbert | Submission receipt and exact file archive saved |
| 1–7 Dec | 7-day pilot with one dorm class (15–20 students, 2 courses). **Owners:** Full team | All Table 8 metrics & multi-evening dorm Wi-Fi logs recorded |
| 7 Dec | Top 10 announcement | Finalist participation confirmed |
| 7–15 Dec | Pilot bug fixes, iOS Safari check, & Final Day prep. **Owners:** see 5.3 | Top pilot bugs resolved, tests green, baseline commit tagged (5.4 reserved for Final Day) |
| 16 Dec | Final Day build session & pitch | All three 5.4 tasks built, verified, packaged, and pitched |

*Table 7. Development plan to Final Day.*

### 5.3 Member contributions

| Member | Done so far | Planned until Final Day |
|---|---|---|
| **Gilbert Gultom** (team leader) | Designed 4-layer Clean Architecture, authored Postgres schema & 6 RLS/auth migrations (incl. NIM format guard, `trg_notes_lww`, & admin role RPCs), led sync/JWT/PDF security hardening, maintained 126 Vitest tests, and deployed Vercel CI/CD. | Fix pilot sync issues & verify live Supabase/Vercel readiness (7–15 Dec); build visual Storage Manager & Class Access Control rules/UI (5.4) on Final Day. |
| **Albert Damian Sitorus** | Built React UI & design system, NIM auth/profile screens, Dexie IndexedDB offline store & sync integration, offline search, deadline checklist, desktop sidebar, CSS animation migration, mobile UI polish (button wrap & shortcut hints), and Redmi Note 12 testing. | Fix top pilot usability bugs & run iOS Safari verification (7–15 Dec); build bulk paste-to-week parser, co-editor conflict UI, & "What changed" digest on Final Day. |
| **Zaki Irfansyahputra Silalahi** | Designed & analyzed the 44-student dorm survey, interviewed class rep & secured lecturer consent, ran dorm Speedtests, Redmi 12 testing, & pre-submission usability check, and structured proposal/validation plans. | Produce `<2 min` English demo video, run 1–7 Dec pilot & Table 8 measurements (incl. Day-1 lookup baseline), maintain demo checklist, and co-lead live demo & Q&A. |

### 5.4 Planned Final Day tasks
1. **Bulk weekly paste-import & co-editor invites (with conflict protection).** Add a paste-from-text weekly parser (turning a WhatsApp/syllabus block into structured materials and deadlines offline) plus co-editor invites backed by entity-level optimistic concurrency (`updated_at`/row version check so concurrent edits to the same row surface a safe conflict prompt). *Done when:* a rep enters 1 course week in `<5 min` offline and a co-editor publishes an update on a second device with conflict detection verified.
2. **"What changed" offline digest & visual Storage Manager.** Add a Home digest banner summarizing items updated since last visit, plus a Storage Manager screen displaying per-course MB, `navigator.storage.persist()` status (with iOS Add-to-Home-Screen guidance), and one-tap PDF eviction that preserves private notes. *Done when:* returning offline users see changes and safely reclaim PDF storage.
3. **Class Access Control UI & top pilot usability fix.** Add a Manage-tab security panel for verified coordinator class creation, one-tap join-code rotation/expiry, member caps, and optional class NIM roster allow-listing (enforced by Postgres RLS), plus the #1 usability fix from the 1–7 Dec pilot. *Done when:* rotated codes visibly block stale invites, unauthorized accounts cannot squat unlisted NIMs or create classes, and pilot fixes pass Vitest.

We continue in the same repository from the preliminary phase and do not restart from an empty project.

---

## 6. Validation and Impact

### 6.1 Validation plan & early usability check
- **Pre-submission usability check (26–28 Nov, non-team dorm peers):** `[FILL BEFORE SUBMIT: Replace with real results from 5–8 non-team dorm students — e.g., "Before submission, n = 7 non-team dorm students completed unaided sign-up, course follow, and airplane-mode deadline lookup on their own phones: X/7 signed up unaided, offline lookup took X–X s (vs XX–XX s in WhatsApp/local files), and X/7 opened cached materials with zero signal."]`
  *(Baseline exploratory check already completed on 25 Nov, `n = 3` — 2 non-team peers + 1 team member: 28–41 s in unindexed WhatsApp/local files vs 5–7 s in cached LiteLearn.)*
- **Full 7-day dormitory class pilot (1–7 Dec 2026):** Voluntary pilot with 15–20 residents in one class and two courses. Written consent was secured on 25 Nov from a course lecturer (internal dorm-only summaries/schedules) and a class rep (tester & contributor; team seeds Week 1 so rep effort strictly measures Week 2+).
- **Decision thresholds:** If `<70%` of materials open offline, we prioritize caching fixes before Final Day; if median deadline lookup exceeds `15 s`, we simplify the Home hierarchy.

| Measure | How we measure it | Current baseline / early check | Proposed pilot target |
|---|---|---|---|
| Materials readable with no signal | Airplane-mode check: % of followed-course items opened | Verified on 2 phones (`[+ n=X early check]`) | `≥90%` |
| Offline first screen | Cold-start time to Home in airplane mode | **1.5–2.0 s** (Redmi 12 / Note 12) | `<2 s` |
| Find next deadline offline | Timed airplane-mode lookup vs WhatsApp/local files | Exploratory `n = 3`: **5–7 s** vs 28–41 s (`[+ n=X early check]`) | `<15 s` (`≥80%` success; faster than Day-1 baseline) |
| Unaided sign-up | % of users completing NIM + join-code sign-up without help | `[n=X early check: X/X]` | `≥80%` |
| Data use | First-load JS & incremental delta-sync payload in DevTools | **154.05 KB** base gzip JS; delta sync: `[X.X KB measured]` | `<200 KB` gzip JS; `<20 KB` delta sync |
| Usefulness after real use | Post-pilot 1–5 rating (full distribution reported) | Pilot pending (survey hypothetical interest: 42/44 rated 4–5/5) | Median `≥4 / 5` |
| Content-supply effort & coverage | Rep/co-editor weekly entry time & % weeks filled (Week 2+ only) | Pilot pending | `<5 min/week`; `≥85%` weeks filled |

*Table 8. Validation measures and targets. We make no statistical generalization claims from a single-class pilot.*

### 6.2 Expected benefit
Students open weekly study outlines and locate urgent deadlines immediately during evening dorm outages without waiting for signal or scrolling through chat noise. Class representatives enter weekly updates once instead of fielding repetitive deadline questions. The pilot quantifies offline access rate, lookup speedup, and weekly rep effort (Table 8).

### 6.3 Risks and mitigations

| Risk | Mitigation |
|---|---|
| **Rep entry fatigue / empty-app risk** (only 30% cite reps directly today) | Single-entry workflow (enter once in LiteLearn, share 1 summary/link to WA); 1 rep committed for 1–7 Dec pilot; team seeds Week 1 and measures Week 2+ effort (`<5 min/week`); Postgres RLS already supports multiple class editors (`rep`, `lecturer`, `assistant`); paste-to-week parser & co-editor invites ship on Final Day (5.4). |
| **Lecturer restricts PDF slide re-uploads** | Text-first design retains core offline value (weekly outlines, key-concept summaries, deadlines, announcements, daytime links, private notes) without requiring copyrighted slide PDFs; internal PDFs cached only with lecturer consent. |
| **Sync fails or JWT expires after prolonged offline use** | `ensureFreshSession()` refreshes JWTs before pushing; outbox with exponential backoff never deletes queued edits on network drop or `401`; user-scoped queue survives re-login. |
| **Browser storage eviction (incl. iOS Safari 7-day limit)** | Guide users to install PWA to Home Screen; `navigator.storage.persist()`, visual Storage Manager, and quota-full handling ship on Final Day (5.4). |
| **Supabase Free tier pauses after 7 days idle** | Scheduled keep-alive pings before pilot and Final Day; Local Demo Mode guarantees instant zero-network fallback. |
| **Tight schedule before 30 Nov & Final Day Q&A readiness** | Freeze scope early; primary lecturer/rep consent secured; full team runs architecture & code walkthroughs so every member explains core modules. |

*Table 9. Main risks and mitigations.*

### 6.4 Privacy, security, copyright, and data protection
- **Data minimization:** Collects only NIM, display name, class membership, optional profile fields (program, bio, avatar), course follows, and private notes—no personal email, phone number, or location.
- **Auth & NIM squatting defense:** Passwords are managed by Supabase Auth; NIM maps internally to `<nim>@nim.litelearn.local` in the data layer only. To mitigate **NIM squatting** (someone registering a classmate's NIM using a leaked join code):
  1. *Implemented now (migrations 004 & 006):* `handle_new_auth_user()` derives NIM authoritatively from the auth identifier, validates the strict IT Del regex (`^[0-9]{2}[A-Z][0-9]{5}$`), and ignores spoofed client metadata; `check_class_join_code()` blocks invalid codes before account creation; self-registration is strictly **student-only** (never grants editor rights); and Admin RPCs (`admin_set_user_active`, `admin_update_user_profile`) allow rapid account reclamation during the pilot.
  2. *Final Day hardening (5.4):* One-tap join-code rotation/expiry, per-class member caps, and optional pre-approved class NIM allow-list verification enforced in Postgres RLS.
- **Row Level Security:** Postgres RLS restricts reads to a user's own class, content writes to verified class editors (`rep`, `lecturer`, `assistant`, `admin`), and private notes exclusively to `user_id = auth.uid()`.
- **Copyright & local privacy:** Notes and cached PDFs stay on-device (clearable in Settings). Reps upload only schedules, original summaries, or lecturer-approved/open materials. Survey data is anonymous; demo records are fabricated.

### 6.5 Sustainability
Static Vercel Hobby hosting and Supabase Free tier keep single-class pilot operating costs at **\$0/month** (limits in Table 5). Content is maintained by class reps/co-editors as part of their existing weekly communication role. Post-competition, anonymized pilot findings will be shared with IT Del campus IT and student affairs without assuming official LMS integration.

---

## 7. References and Declaration

### 7.1 Third-party resources
LiteLearn uses open-source libraries and managed cloud services with full attribution.

| Resource | Use |
|---|---|
| React, React Router, TypeScript, Vite | Front-end UI and route-split build tooling |
| Dexie | IndexedDB wrapper for offline-first local storage |
| `vite-plugin-pwa` and Workbox | Service worker precaching and installable PWA manifest |
| Supabase (JS client & hosted backend) | Authentication, PostgreSQL with RLS, and PDF file storage |
| Sonner | Lightweight toast notifications (animations use pure CSS) |
| Vercel | Static HTTPS hosting |
| Vitest | Automated unit, sync, accessibility-contrast, and boundary tests |

### 7.2 Material AI assistance
All core engineering decisions and substantive deliverables were led and executed by the team: problem discovery and the 44-student dormitory survey (Zaki), 4-layer Clean Architecture design, PostgreSQL schema/RLS security rules, and sync hardening (Gilbert), React UI/UX, Dexie IndexedDB integration, Workbox PWA setup, and physical device debugging (Albert), plus manual integration, verification, and end-to-end testing across the team.

Where AI tools assisted our workflow, their roles were strictly scoped and supervised:
- **Claude (Anthropic):** Assisted with English editorial polishing, structuring survey wording, and drafting/tightening sections of our product requirements and proposal text. All survey responses, Speedtest readings, and phone test results are real measurements collected by the team; Claude supplied no data or results.
- **Antigravity / Gemini (Google):** Assisted with boilerplate module scaffolding, initial Vitest test drafts, and code-review/linting checks based on our team-authored specifications. Every generated snippet was reviewed, debugged, modified where needed, and manually verified against the 126-test Vitest suite and physical devices by Gilbert Gultom and Albert Damian Sitorus.

All three members conduct internal architecture walkthroughs, run the 126-test Vitest suite locally, and can explain and defend core design decisions. This disclosure is mirrored in the repository `README.md`.

### 7.3 References
[1] ITD boys, anonymous survey of IT Del dormitory students on access to study information, 44 respondents, 23–28 Oct 2026.  
[2] Institut Teknologi Del, official dormitory facilities information (`del.ac.id`): mandatory on-campus dormitories across 8 buildings (~1,600 student capacity; 90–400 residents per hall).  
[3] IT Del E-Course (`ecourse.del.ac.id`, Moodle-based LMS) and MoodleDocs, "Mobile web services" (`docs.moodle.org`).

### 7.4 Declaration of Originality
The signed Declaration of Originality is attached as Appendix A on the next page.

---

## Appendix A: Declaration of Originality
*(Verify exact wording line-by-line against `s.id/DeclarationOfOriginalitySTACK2026` before printing and signing.)*

I, the undersigned, as the Team Leader of **ITD boys**, hereby declare on behalf of all registered team members that the project entitled **“LiteLearn: A Low-Bandwidth Study Assistant for Students”**, submitted to **STACK 2026** organized by **GDGoC ITB**, is our original work, developed specifically for this competition. We affirm that this project is not copied from, adapted from, or repackaged from any existing project or previous competition submission. All substantive aspects of the proposed solution and its development have been carried out by the registered team members. Any third-party resources, including frameworks, libraries, APIs, datasets, or general-purpose templates, have been used with appropriate permissions and acknowledgments. Furthermore, any material AI assistance has been properly disclosed in the proposal and product README, including the tools used and their respective roles. We also confirm that all information regarding research, testing, development progress, and individual contributions is presented accurately and truthfully.

`[FILL BEFORE SUBMIT: Laguboti, DD November 2026]`  
Team Leader,

`[Place wet or clean scanned signature here, above the name]`

**Gilbert Gultom**  
`[FILL BEFORE SUBMIT: Gilbert's NIM]` – Institut Teknologi Del
