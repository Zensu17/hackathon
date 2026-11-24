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

<!-- impeccable:design-map -->
Name: LiteLearn
Colors: primary: academic-navy #1D3E8A; secondary: academic-gold #855A10; neutral: ivory-paper #F6F4EE; secondary: offline-emerald #166E45; secondary: due-soon-ochre #8F5B10 (+3 more in the sidecar)
Fonts: Source Serif 4 (display, headline, title); Plus Jakarta Sans (body, label); JetBrains Mono (mono)
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
