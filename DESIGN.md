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

<!-- impeccable:design-map -->
Name: LiteLearn
Colors: primary: academic-navy #1E3A8A; secondary: academic-gold #875E16; neutral: ivory-paper #F7F5F0; secondary: offline-emerald #1C7449; secondary: due-soon-ochre #926016 (+3 more in the sidecar)
Fonts: Source Serif 4 (display, headline, title); Inter (body, label); ui-monospace (mono)
Spacing: 1 4px, 2 8px, 3 12px, 4 16px, 6 24px, 8 32px, 12 48px
Radius: sm 8px, md 12px, lg 16px, full 999px
North Star: "The Dormitory Study Index"
Elevation:
- The Calm Surface Rule.
Don't:
- Don't add gradients, blur stacks, grids, emojis, or stock art.
- Don't auto-download PDFs when `Data saver` is ON or fake bytes.
- Don't hardcode fake announcements or fabricated metrics.
- Don't use course accents for urgency or nest cards.
- Don't hide focus outlines or remove buttons from tab order.
Do:
- Do verify WCAG AA via [contrastAndCopy.test.ts](src/tests/architecture/contrastAndCopy.test.ts).
- Do pair every status color with an SVG icon and text.
- Do show `Available offline` only after IndexedDB save, separate from `Synced`.
- Do disable motion under `prefers-reduced-motion: reduce`.
- Do keep `>= 44x44px` targets and `2px` `:focus-visible` outlines.
Map: src/presentation/styles/tokens.css
Map: docs/FIGMA-HANDOFF.md
Map: src/presentation/components/FigmaComponents.tsx
Map: src/presentation/components/AppLayout.tsx
Map: src/presentation/components/Icons.tsx
Map: src/tests/architecture/contrastAndCopy.test.ts
Full: .impeccable/design-full.md (read a section when you need its detail)
