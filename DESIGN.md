# DESIGN: LiteLearn

## Identity & Mood

- Product: LiteLearn, a low-bandwidth, offline-first study index for IT Del dormitory students.
- Aesthetic: Crisp academic index-card sheet. Calm, legible, structured like a course binder tab system rather than a marketing app.
- Audience context: First- and second-year dorm residents reading course weeks, deadlines, and notes on 360 px phone screens, mostly in the afternoon and evening on unstable Wi-Fi.
- Dial: `ENERGY 1 / RHYTHM 1 / MOTION 1`
- Design Read: `Offline study index for dormitory students on mobile phones, in a crisp academic index-card style, dial ENERGY 1 / RHYTHM 1 / MOTION 1.`

## Theme System (Light + Dark Toggle)

Both Light and Dark themes ship as first-class modes with a persistent user toggle in Settings and header quick-switch, defaulting to system preference (`prefers-color-scheme`) on first visit.

### Core Palette (2 Core Colors + 1 Deliberate Accent + Neutrals)

| Token | Light Mode | Dark Mode | Role & Contrast Verification |
|---|---|---|---|
| `--bg-page` | `#F7F6F2` | `#0F1724` | Warm index-paper base (light) / deep slate study surface (dark) |
| `--bg-card` | `#FFFFFF` | `#172235` | Elevated index card surface |
| `--ink-primary` | `#142033` | `#EDF1F7` | Primary reading text (15.12:1 light, 14.07:1 dark on card/page) |
| `--ink-secondary` | `#46546B` | `#A8B5C9` | Timestamps, file sizes, metadata (7.09:1+ light, 7.68:1+ dark) |
| `--border-subtle` | `#748299` | `#687894` | Card and input boundaries (3.60:1 light, 3.57:1 dark, passes 3:1 WCAG 1.4.11) |
| `--color-primary` | `#1B3A6B` | `#8AB4F8` | Core academic navy for primary actions, active nav tab, focus ring (11.27:1 light with `#FFFFFF` ink; 8.53:1 dark with `#0F1724` ink) |
| `--color-accent-rust` | `#9E331D` | `#F59E8B` | Deliberate accent reserved strictly for overdue and due-within-24h deadline urgency (7.13:1 light, 7.71:1 dark) |
| `--bg-accent-rust` | `#FDF2EE` | `#3B1812` | Urgency row tint paired with `--ink-accent-rust` (`#8C2D19` light at 7.63:1, `#FFDAD2` dark at 12.23:1) |

Network state indicators always pair a short text label (`Offline`, `Slow`, `Online`) and distinct shape (`square`, `triangle`, `circle`) with color so state never relies on hue alone.

## Typography

- Font family: System UI sans stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`) for zero network font payload.
- Monospace stack (`ui-monospace, "Cascadia Code", Consolas, monospace`) reserved strictly for join codes, course codes (`IF1101`), and byte sizes (`1.4 MB`).
- Fluid scale via `clamp()` that reflows cleanly at 360 px width and 200% browser zoom without clipping:
  - Screen title (`h1`): `clamp(1.25rem, 1.1rem + 0.75vw, 1.625rem)`, weight `700`, line-height `1.25`
  - Section / Week heading (`h2`): `clamp(1.0625rem, 1rem + 0.3vw, 1.25rem)`, weight `650`, line-height `1.3`
  - Item title (`h3`): `1rem`, weight `600`, line-height `1.35`
  - Body copy: `1rem` (`16px`), weight `400`, line-height `1.5`
  - Metadata / status label: `0.875rem` (`14px`), weight `500`, line-height `1.4`

## Layout, Rhythm, and Levers

- One focal point per screen:
  - Home: Upcoming deadlines list (due within 24h and overdue surfaced first).
  - Courses: Followed courses toggle list.
  - Course Detail: Ordered week index (`Week 1`, `Week 2`, ...) with collapsible or scannable sections.
  - Material Detail: Text summary and explicit on-demand download control showing exact file size.
- Identity motif: Crisp top-bordered index card with a monospace course/week tab code (`[WEEK 03]` / `CRS-101`) aligned to a 1 px solid structural rule.
- Border radius hierarchy (no uniform pills):
  - Index cards and panels: `6px`
  - Buttons and form inputs: `4px`
  - Status chips: `2px` squared tag with 1 px solid border
- Elevation and shadow: Zero decorative drop shadows on cards (`box-shadow: none`). Structural 1 px borders separate cards from `--bg-page`; a subtle `0 2px 6px rgba(0, 0, 0, 0.12)` elevation is reserved exclusively for sticky navigation chrome or modal dialogs.
- Spacing scale: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`. Tighter `12px`/`16px` container padding at 360 px mobile width, expanding to `24px` above `640px` and centered `760px` max reading column on desktop.
- Touch targets and navigation:
  - Minimum `44px x 44px` tap area with at least `8px` gap between adjacent controls.
  - Mobile (`< 640px`): Compact fixed bottom bar (`56px` height + `env(safe-area-inset-bottom)`) with matching bottom scroll padding on `<main>` so content is never covered. Destinations: `Home`, `Courses`, `Settings` (plus `Manage` for `rep` users).
  - Tablet / Desktop (`>= 640px`): Reflows to a compact top header bar with horizontal links.
- Motion (`MOTION 1`): Instant state transitions and `:hover` / `:active` / `:focus-visible` affordances only. No scroll reveals, no pulsing status dots, and `@media (prefers-reduced-motion: reduce)` respected globally.
- Brand mark: Plain typographic `LiteLearn` wordmark in UI; minimal geometric `LL` monogram SVG/PNG solely for the required PWA web manifest icon.

## One-Line Decision Log (R-31)

- Palette: Navy (`#1B3A6B`) anchors calm academic reading, while rust (`#9E331D`) appears only when a deadline is overdue or due within 24 hours so urgency stands out immediately.
- Typography: System sans-serif downloads zero font bytes on slow dorm Wi-Fi, while system monospace distinguishes join codes, course codes, and file sizes at a glance.
- Layout (`RHYTHM 1`): Predictable single-column index-card stacking lets tired students scan weeks, deadlines, and materials in seconds on a 360 px screen.
- Cards & Borders: Flat 1 px high-contrast borders (`3.6:1`) replace soft shadows so card boundaries stay crisp on dim phone screens in both light and dark modes.
- Icons: Text labels carry primary meaning; minimal inline geometric status marks (`Offline`, `Slow`, `Online`) exist only to reinforce network state without relying on color alone.
- Theme Toggle: Dorm students study heavily in the afternoon and evening, so both warm paper light mode and deep-slate dark mode are supported with verified WCAG AA contrast.
