---
name: LiteLearn
description: Calm, low-bandwidth academic design system for offline-first study.
colors:
  academic-navy: "#1E3A8A"
  ivory-paper: "#F7F5F0"
  clean-sheet: "#FFFFFF"
  warm-linen: "#EFEBE3"
  paper-rule: "#E3DED3"
  control-slate: "#748299"
  ink-navy: "#14213D"
  muted-slate: "#5B6478"
  academic-gold: "#875E16"
  offline-emerald: "#1C7449"
  due-soon-ochre: "#926016"
  overdue-crimson: "#B42318"
typography:
  display:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: 600
    lineHeight: 34px
  headline:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: 600
    lineHeight: 30px
  title:
    fontFamily: Source Serif 4
    fontSize: 20px
    fontWeight: 600
    lineHeight: 26px
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
  label:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
  mono:
    fontFamily: ui-monospace
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
    padding: 0 16px
    height: 44px
  button-secondary:
    backgroundColor: "{colors.clean-sheet}"
    textColor: "{colors.ink-navy}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 0 16px
    height: 44px
  card-surface:
    backgroundColor: "{colors.clean-sheet}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.md}"
    padding: 16px
  input-default:
    backgroundColor: "{colors.clean-sheet}"
    textColor: "{colors.ink-navy}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: 0 12px
    height: 52px
  chip-success:
    backgroundColor: "{colors.warm-linen}"
    textColor: "{colors.offline-emerald}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 0 8px
    height: 32px
---

# Design System: LiteLearn

> Figma `LiteLearn Design` (`hNrbr8VaIqVatLlQRbIvg7`, `3:13158` Light, `3:22129` Dark) | [tokens.css](src/presentation/styles/tokens.css) | [FIGMA-HANDOFF.md](docs/FIGMA-HANDOFF.md)

## Overview

> **Creative North Star: "The Dormitory Study Index"**
> Offline-first workspace for IT Del students on 360px phones during network drops. Calm restraint (Energy 1, Rhythm 1, Motion 1) answers what is due next, what opens offline, and what is synced.

- **Warm Paper & Slate:** Light ivory and dark slate passing WCAG 2.2 AA (44 pairings).
- **Editorial-Technical Type:** `Source Serif 4` headings, `Inter` body, tabular `ui-monospace`.
- **Vector-Only Shell:** 24x24 SVG icons (`1.75-2px` stroke), zero decorative shell images.
- **Honest Offline States:** `Available offline`, `Following`, `Queued`, `Synced` stay distinct.
- **One-Thumb Ergonomics:** `44px` tap targets from 360px bottom bar to 1280px sidebar.

## Colors

Tokens in [tokens.css](src/presentation/styles/tokens.css) (`>= 4.5:1` text, `>= 3.0:1` UI).

| Role | Light | Dark (Obsidian) | AA (L/D) | Usage |
|---|---|---|---|---|
| Canvas | `#F7F5F0` | `#050608` | Base | Backdrop |
| Surface | `#FFFFFF` | `#0C0E13` | Base | Cards, inputs |
| Surface 2 | `#EFEBE3` | `#141821` | Step | Active pills |
| Hairline | `#E3DED3` | `#222733` | Line | Card borders |
| Control | `#748299` | `#687387` | >= 3.0 | Control borders |
| Primary Ink | `#14213D` | `#F8FAFC` | 15.97/18.42 | Headings, body |
| Muted Ink | `#5B6478` | `#94A3B8` | 5.93/7.74 | Metadata, dates |
| Primary | `#1E3A8A` | `#60A5FA` | 10.36/7.82 | CTA, focus ring |
| Accent | `#875E16` | `#E0B352` | 5.83/10.21 | Small marks |
| Success | `#1C7449` | `#34D399` | 5.65/10.58 | Offline, Online |
| Warning | `#926016` | `#FBBF24` | 5.42/11.73 | Due 24h, Slow |
| Danger | `#B42318` | `#F87171` | 6.23/6.92 | Overdue, errors |

**Course Strips (`4px`):** `#1E3A8A`, `#0F766E`, `#7C3AED`, `#B45309`, `#BE185D`, `#475569`. **Overdue Wash:** `#FBEAE8`.

- **The Icon-Plus-Text Status Rule.** Never signal status by color alone; pair an SVG icon with text.
- **The Subject-Not-Urgency Rule.** Course accents mark subjects only; urgency uses Ochre or Crimson.
- **The Restrained Gold Rule.** Academic Gold stays under 5% of any viewport, never on buttons or cards.

## Typography

| Scale | Family | Size / LH | Wt | Usage |
|---|---|---|---|---|
| Display | `Source Serif 4` | 28 / 34px | 600 | Greetings, landmarks |
| Headline | `Source Serif 4` | 24 / 30px | 600 | Screen titles, wordmark |
| Title | `Source Serif 4` | 20 / 26px | 600 | Section headers |
| Body | `Inter` | 16 / 24px | 400 | Summaries, notes (`65-75ch`) |
| Label | `Inter` | 14 / 20px | 600 | Buttons, inputs, tabs |
| Caption | `Inter` | 12 / 16px | 500 | Timestamps, chips, hints |
| Mono | `ui-monospace` | 14 / 20px | 500 | NIM, codes, byte sizes |

- **The Zero-Em-Dash Rule.** Never use em or en dashes in UI copy; use periods, commas, colons, or hyphens.
- **The Tabular Data Rule.** Apply `font-variant-numeric: tabular-nums` to dates, NIMs, byte sizes, and counts.

## Layout

`4px` grid (`4, 8, 12, 16, 24, 32, 48px`), left-aligned prose.

| Viewport | Nav | Workspace | Pad |
|---|---|---|---|
| Mobile (`360-1023px`) | Sticky header + `64px` `BottomNav` | `100%` | `16px` |
| Laptop (`>= 1024px`) | `240px` `SideNav` | `976px` (`616`+`336px`, `24px` gap) | `32px` |
| Focused Views | Shared shell | Auth `420px`, Settings `640px` | `16-32px` |

- **The One-Thumb Mobile Rule.** Below `480px`, primary CTAs span `100%`; targets stay `>= 44x44px` (`8px` gap).

## Elevation & Depth

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--shadow-1` | `0 1px 3px rgba(20,33,61,.08)` | `none` | Cards, active tab |
| `--shadow-2` | `0 8px 24px rgba(20,33,61,.14)` | `0 8px 24px rgba(0,0,0,.45)` | Modals, hover |

- **The Calm Surface Rule.** Keep static panels matte with `1px` `--color-border` hairlines; no heavy shadows, glows, or blur.

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
| Buttons | `8px`, `44px` M or `52px` L, `150ms` | Primary, Secondary, Ghost, Danger; `1px` press |
| Chips | `999px`, `32px` S or `40px` M, `12%` tint | `14px` SVG icon + text |
| Cards | `12px`, `16px` pad, `1px` hairline | Urgent `#FBEAE8`+`3px` bar; `CourseCard` `4px` strip |
| Inputs | `8px`, `44-52px`, `--border-subtle` | Persistent label, `role="alert"`, `44px` toggle |
| Navigation | `BottomNav` Warm Linen; `SideNav` `240px` | `hug` join code, live `NetworkStatus` |
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
