---
name: LiteLearn
description: Calm, low-bandwidth academic design system for offline-first study.
colors:
  academic-navy: "#1D3E8A"
  ivory-paper: "#F6F4EE"
  clean-sheet: "#FFFFFF"
  warm-linen: "#EDE9DF"
  paper-rule: "#DFD9CC"
  control-slate: "#6B788E"
  ink-navy: "#13203B"
  muted-slate: "#515B70"
  academic-gold: "#855A10"
  offline-emerald: "#166E45"
  due-soon-ochre: "#8F5B10"
  overdue-crimson: "#B42318"
typography:
  display:
    fontFamily: Source Serif 4
    fontSize: 30px
    fontWeight: 600
    lineHeight: 36px
  headline:
    fontFamily: Source Serif 4
    fontSize: 26px
    fontWeight: 600
    lineHeight: 32px
  title:
    fontFamily: Source Serif 4
    fontSize: 21px
    fontWeight: 600
    lineHeight: 28px
  body:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 26px
  label:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 600
    lineHeight: 21px
  mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  full: 999px
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  6: 24px
  8: 32px
  12: 48px
components:
  button-primary:
    backgroundColor: "{colors.academic-navy}"
    textColor: "{colors.clean-sheet}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 0 18px
    height: 44px
  button-secondary:
    backgroundColor: "{colors.clean-sheet}"
    textColor: "{colors.ink-navy}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 0 18px
    height: 44px
  card-surface:
    backgroundColor: "{colors.clean-sheet}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.md}"
    padding: 22px
  input-default:
    backgroundColor: "{colors.clean-sheet}"
    textColor: "{colors.ink-navy}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: 11px 14px
    height: 48px
  chip-success:
    backgroundColor: "{colors.warm-linen}"
    textColor: "{colors.offline-emerald}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 0 11px
    height: 30px
---

# Design System: LiteLearn

> Figma `LiteLearn Design` (`hNrbr8VaIqVatLlQRbIvg7`, `3:13158` Light, `3:22129` Dark) | [tokens.css](src/presentation/styles/tokens.css) | [FIGMA-HANDOFF.md](docs/FIGMA-HANDOFF.md)

## Overview

> **Creative North Star: "The Dormitory Study Index"**
> Offline-first workspace for IT Del students on 360px phones during network drops. Calm restraint (Energy 1, Rhythm 1, Motion 1) answers what is due next, what opens offline, and what is synced.

- **Warm Paper & Midnight Slate:** Soft warm paper light (`#F6F4EE`) and comfortable midnight study slate dark (`#0F141F`) passing WCAG 2.2 AA across all pairings.
- **Editorial-Technical Type:** `Source Serif 4` headings, `Plus Jakarta Sans` UI & body (`16px` / `26px`), tabular `JetBrains Mono`.
- **Vector-Only Shell:** 24x24 SVG icons (`2px` stroke), zero decorative shell images.
- **Honest Offline States:** `Available offline`, `Following`, `Queued`, `Synced` stay distinct.
- **One-Thumb Ergonomics:** `44px` tap targets from 360px bottom bar to 1280px sidebar.

## Colors

Tokens in [tokens.css](src/presentation/styles/tokens.css) (`>= 4.5:1` text, `>= 3.0:1` UI).

| Role | Light | Dark (Midnight Slate) | Usage |
|---|---|---|---|
| Canvas | `#F6F4EE` | `#0F141F` | Backdrop |
| Surface | `#FFFFFF` | `#161D2B` | Cards, inputs |
| Surface 2 | `#EDE9DF` | `#1F283A` | Active pills |
| Hairline | `#DFD9CC` | `#2C374D` | Card borders |
| Control | `#6B788E` | `#7A8BA6` | Control borders (`>= 3.0`) |
| Primary Ink | `#13203B` | `#EDF2F9` | Headings, body |
| Muted Ink | `#515B70` | `#9FB0C8` | Metadata, dates |
| Primary | `#1D3E8A` | `#7CB3FF` | CTA, focus ring |
| Accent | `#855A10` | `#E6BA5A` | Small marks |
| Success | `#166E45` | `#4ADE9F` | Offline, Online |
| Warning | `#8F5B10` | `#F5C14E` | Due 24h, Slow |
| Danger | `#B42318` | `#FF8585` | Overdue, errors |

**Course Strips (`4px`):** `#1D3E8A`, `#0F766E`, `#6D28D9`, `#B45309`, `#BE185D`, `#475569`. **Overdue Wash:** `#FDF0EE` (light) / `#2A1519` (dark).

- **The Icon-Plus-Text Status Rule.** Never signal status by color alone; pair an SVG icon with text.
- **The Subject-Not-Urgency Rule.** Course accents mark subjects only; urgency uses Ochre or Crimson.
- **The Restrained Gold Rule.** Academic Gold stays under 5% of any viewport, never on buttons or cards.

## Typography

| Scale | Family | Size / LH | Wt | Usage |
|---|---|---|---|---|
| Display | `Source Serif 4` | 30 / 36px | 600 | Greetings, landmarks |
| Headline | `Source Serif 4` | 26 / 32px | 600 | Screen titles, wordmark |
| Title | `Source Serif 4` | 21 / 28px | 600 | Section headers |
| Body | `Plus Jakarta Sans` | 16 / 26px | 400 | Summaries, notes (`65-75ch`) |
| Label | `Plus Jakarta Sans` | 14 / 21px | 600 | Buttons, inputs, tabs |
| Caption | `Plus Jakarta Sans` | 13 / 18px | 500 | Timestamps, chips, hints |
| Mono | `JetBrains Mono` | 14 / 20px | 500 | NIM, codes, byte sizes |

- **The Zero-Em-Dash Rule.** Never use em or en dashes in UI copy; use periods, commas, colons, or hyphens.
- **The Tabular Data Rule.** Apply `font-variant-numeric: tabular-nums` to dates, NIMs, byte sizes, and counts.

## Layout

`4px` grid (`4, 8, 12, 16, 24, 32, 48px`), left-aligned prose.

| Viewport | Nav | Workspace | Pad |
|---|---|---|---|
| Mobile (`360-1023px`) | Sticky solid header + `68px` `BottomNav` | `100%` | `16px` |
| Laptop (`>= 1024px`) | `264px` `SideNav` | `980px` | `28-36px` |
| Focused Views | Shared shell | Auth split (`980px`), Settings (`680px`) | `16-32px` |

- **The One-Thumb Mobile Rule.** Below `480px`, primary CTAs span `100%`; targets stay `>= 44x44px` (`8px` gap).

## Elevation & Depth

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--shadow-1` | `0 1px 2px rgba(19,32,59,.05), 0 2px 8px rgba(19,32,59,.05)` | `0 1px 2px rgba(4,8,16,.28), inset 0 1px 0 rgba(255,255,255,.04)` | Cards, active tab |
| `--shadow-2` | `0 6px 18px rgba(19,32,59,.08), 0 14px 32px rgba(19,32,59,.10)` | `0 10px 28px rgba(4,8,16,.48), inset 0 1px 0 rgba(255,255,255,.06)` | Modals, hover |

- **The Calm Surface Rule.** Keep static panels matte with `1px` `--color-border` hairlines; no heavy shadows, glows, or blur stacks.

## Shapes

| Tier | Radius | Application |
|---|---|---|
| `sm` / `md` | `8px` / `12px` | Controls & inputs / Cards & callouts |
| `lg` / `full` | `16px` / `999px` | Modals & toasts / Chips, toggles, pills |

Borders: `1px var(--color-border)` hairlines, `var(--border-subtle)` controls; focus `2px var(--color-primary)` (`2px` offset).

## Components

[FigmaComponents.tsx](src/presentation/components/FigmaComponents.tsx) | [AppLayout.tsx](src/presentation/components/AppLayout.tsx) | [Icons.tsx](src/presentation/components/Icons.tsx)

| Component | Tokens | Behavior |
|---|---|---|
| Buttons | `8px`, `44px` M or `50px` L, `150ms` | Primary, Secondary, Ghost, Danger |
| Chips | `999px`, `30px` S or `38px` M, `12%` tint | `14px` SVG icon + text |
| Cards | `12px`, `22px` pad, `1px` hairline | Urgent wash; `CourseCard` `4px` top strip |
| Inputs | `8px`, `48px`, `--border-subtle` | Persistent label, `role="alert"`, `44px` toggle |
| Navigation | Solid `BottomNav` / `264px` `SideNav` | `hug` join code, live `NetworkStatus` |
| Study UI | `DeadlineItem`, `SegmentedControl`, `Toggle` | IndexedDB PDFs, `Private notes`, `Data saver` |

## Do's and Don'ts

### Do:
- **Do** verify WCAG AA via [contrastAndCopy.test.ts](src/tests/architecture/contrastAndCopy.test.ts).
- **Do** pair every status color with an SVG icon and text.
- **Do** show `Available offline` only after IndexedDB save, separate from `Synced`.
- **Do** disable motion under `prefers-reduced-motion: reduce`.
- **Do** keep `>= 44x44px` targets and `2px` `:focus-visible` outlines.

### Don't:
- **Don't** add gradients, blur stacks, grids, emojis, or stock art.
- **Don't** auto-download PDFs when `Data saver` is ON or fake bytes.
- **Don't** hardcode fake announcements or fabricated metrics.
- **Don't** use course accents for urgency or nest cards.
- **Don't** hide focus outlines or remove buttons from tab order.
