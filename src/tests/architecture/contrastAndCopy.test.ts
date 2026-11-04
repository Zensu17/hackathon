import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');
const srcRoot = path.resolve(repoRoot, 'src');

const EM_DASH = '\u2014';
const EN_DASH = '\u2013';

function parseHexChannel(twoHex: string): number {
  return Number.parseInt(twoHex, 16) / 255;
}

function linearizeChannel(channel: number): number {
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Expected 6-digit hex color, received '${hex}'`);
  }
  const r = linearizeChannel(parseHexChannel(normalized.slice(0, 2)));
  const g = linearizeChannel(parseHexChannel(normalized.slice(2, 4)));
  const b = linearizeChannel(parseHexChannel(normalized.slice(4, 6)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function wcagContrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractThemeTokens(
  cssSource: string,
  selectorMarker: string,
): Record<string, string> {
  const markerIndex = cssSource.indexOf(selectorMarker);
  if (markerIndex === -1) {
    throw new Error(`Could not find selector marker '${selectorMarker}' in tokens.css`);
  }
  const openBrace = cssSource.indexOf('{', markerIndex);
  const closeBrace = cssSource.indexOf('}', openBrace);
  if (openBrace === -1 || closeBrace === -1) {
    throw new Error(`Malformed CSS block for '${selectorMarker}'`);
  }
  const block = cssSource.slice(openBrace + 1, closeBrace);
  const tokens: Record<string, string> = {};
  const propPattern = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let match: RegExpExecArray | null = propPattern.exec(block);
  while (match !== null) {
    if (match[1] && match[2]) {
      tokens[match[1].trim()] = match[2].trim();
    }
    match = propPattern.exec(block);
  }
  return tokens;
}

function collectFiles(
  dirPath: string,
  extensions: readonly string[],
  excludeDirNormalized?: string,
): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  const results: string[] = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    const normalized = full.replace(/\\/g, '/');
    if (excludeDirNormalized && normalized.startsWith(excludeDirNormalized)) {
      continue;
    }
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, extensions, excludeDirNormalized));
    } else if (
      entry.isFile() &&
      extensions.some((ext) => entry.name.endsWith(ext))
    ) {
      results.push(full);
    }
  }
  return results;
}

describe('WCAG 2.x contrast, Antislop copy hygiene, and shell semantics', () => {
  const tokensPath = path.join(srcRoot, 'presentation', 'styles', 'tokens.css');
  const tokensCss = fs.readFileSync(tokensPath, 'utf8');
  const lightTokens = extractThemeTokens(tokensCss, ':root[data-theme="light"]');
  const darkTokens = extractThemeTokens(tokensCss, ':root[data-theme="dark"]');

  it('meets WCAG AA >= 4.5:1 normal text contrast across all Light and Dark token pairings (R-25, R-34)', () => {
    const textPairs: ReadonlyArray<[string, string]> = [
      ['--ink-primary', '--bg-page'],
      ['--ink-primary', '--bg-card'],
      ['--ink-primary', '--bg-subtle'],
      ['--ink-primary', '--bg-accent-rust'],
      ['--ink-secondary', '--bg-page'],
      ['--ink-secondary', '--bg-card'],
      ['--ink-secondary', '--bg-accent-rust'],
      ['--ink-on-primary', '--color-primary'],
      ['--ink-on-primary', '--color-primary-hover'],
      ['--ink-accent-rust', '--bg-accent-rust'],
      ['--color-accent-rust', '--bg-card'],
      ['--color-accent-rust', '--bg-page'],
      ['--color-primary', '--bg-card'],
      ['--color-primary', '--bg-page'],
      ['--color-primary', '--bg-accent-rust'],
    ];

    for (const [modeName, palette] of [
      ['light', lightTokens],
      ['dark', darkTokens],
    ] as const) {
      for (const [fgKey, bgKey] of textPairs) {
        const fg = palette[fgKey];
        const bg = palette[bgKey];
        expect(fg, `${modeName} missing ${fgKey}`).toBeDefined();
        expect(bg, `${modeName} missing ${bgKey}`).toBeDefined();
        const ratio = wcagContrastRatio(fg!, bg!);
        expect(
          ratio,
          `${modeName}: ${fgKey} (${fg}) on ${bgKey} (${bg}) measured ${ratio.toFixed(4)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('meets WCAG 1.4.11 >= 3.0:1 non-text boundary and focus ring contrast in Light and Dark modes (R-25, R-32)', () => {
    const boundaryPairs: ReadonlyArray<[string, string]> = [
      ['--border-subtle', '--bg-page'],
      ['--border-subtle', '--bg-card'],
      ['--color-primary', '--bg-page'],
      ['--color-primary', '--bg-card'],
      ['--color-accent-rust', '--bg-page'],
      ['--color-accent-rust', '--bg-card'],
      ['--color-accent-rust', '--bg-accent-rust'],
    ];

    for (const [modeName, palette] of [
      ['light', lightTokens],
      ['dark', darkTokens],
    ] as const) {
      for (const [edgeKey, bgKey] of boundaryPairs) {
        const edge = palette[edgeKey];
        const bg = palette[bgKey];
        expect(edge, `${modeName} missing ${edgeKey}`).toBeDefined();
        expect(bg, `${modeName} missing ${bgKey}`).toBeDefined();
        const ratio = wcagContrastRatio(edge!, bg!);
        expect(
          ratio,
          `${modeName}: ${edgeKey} (${edge}) on ${bgKey} (${bg}) measured ${ratio.toFixed(4)}:1`,
        ).toBeGreaterThanOrEqual(3.0);
      }
    }
  });

  it('keeps all src/ and index.html files free of em/en dashes, buzzwords, generic CTAs, fake names, and emojis (R-02, R-04, R-15, R-16, R-23)', () => {
    const allScanFiles = [
      path.join(repoRoot, 'index.html'),
      ...collectFiles(srcRoot, ['.ts', '.tsx', '.css', '.html']),
    ];

    const nonTestFiles = [
      path.join(repoRoot, 'index.html'),
      ...collectFiles(
        srcRoot,
        ['.ts', '.tsx', '.css', '.html'],
        path.join(srcRoot, 'tests').replace(/\\/g, '/'),
      ),
    ];

    const forbiddenBuzzwords = [
      /\bai[\s-]powered\b/i,
      /\bnext[\s-]generation\b/i,
      /\bnext[\s-]level\b/i,
      /\brevolutionar(?:y|ize|izing)\b/i,
      /\bseamless(?:ly)?\b/i,
      /\bcutting[\s-]edge\b/i,
      /\bintelligent\b/i,
      /\bultimate\b/i,
      /\bpowerful\b/i,
      /\beffortless(?:ly)?\b/i,
      /\bunlock(?:ing)?\b/i,
      /\belevat(?:e|ing)\b/i,
      /\bempower(?:ing)?\b/i,
      /\bdelv(?:e|ing)\b/i,
      /\bshowcas(?:e|ing)\b/i,
      /\btestament\b/i,
      /\bgame[\s-]changer\b/i,
      /\bworld[\s-]class\b/i,
      /\bindustry[\s-]leading\b/i,
    ];

    const forbiddenGenericCtas = [
      /['"`]Get Started['"`]/i,
      /['"`]Learn More['"`]/i,
      /['"`]Try Now['"`]/i,
      /['"`]Explore['"`]/i,
      /['"`]Discover['"`]/i,
    ];

    const forbiddenFakeIdentities = [
      /\bJohn Doe\b/i,
      /\bJane Doe\b/i,
      /\bSarah Chen\b/i,
      /\bjohndoe@example\.com\b/i,
    ];

    const emojiPattern = /\p{Extended_Pictographic}/u;

    const violations: string[] = [];

    for (const file of allScanFiles) {
      const text = fs.readFileSync(file, 'utf8');
      const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
      if (text.includes(EM_DASH)) {
        violations.push(`${rel}: contains forbidden em dash`);
      }
      if (text.includes(EN_DASH)) {
        violations.push(`${rel}: contains forbidden en dash`);
      }
      if (emojiPattern.test(text)) {
        violations.push(`${rel}: contains decorative emoji`);
      }
    }

    for (const file of nonTestFiles) {
      const text = fs.readFileSync(file, 'utf8');
      const rel = path.relative(repoRoot, file).replace(/\\/g, '/');

      for (const pattern of forbiddenBuzzwords) {
        const hit = pattern.exec(text);
        if (hit) {
          violations.push(`${rel}: contains forbidden buzzword '${hit[0]}'`);
        }
      }

      for (const pattern of forbiddenGenericCtas) {
        const hit = pattern.exec(text);
        if (hit) {
          violations.push(`${rel}: contains forbidden generic CTA ${hit[0]}`);
        }
      }

      for (const pattern of forbiddenFakeIdentities) {
        const hit = pattern.exec(text);
        if (hit) {
          violations.push(`${rel}: contains fake identity '${hit[0]}'`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('verifies index.html, base.css, and router.tsx satisfy shell semantics and boundary rules (ARCH-02, R-32, R-39, R-40)', () => {
    const html = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
    expect(html).toMatch(/<html[^>]*\blang="en"/i);
    expect(html).toMatch(/<title>\s*LiteLearn\s*<\/title>/);
    expect(html).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(html).not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/i);
    expect(html).not.toMatch(/<script(?![^>]*\btype="module")[^>]*\bsrc="https?:/i);

    const baseCss = fs.readFileSync(
      path.join(srcRoot, 'presentation', 'styles', 'base.css'),
      'utf8',
    );
    expect(baseCss).toContain(':focus-visible');
    expect(baseCss).toContain('cursor: pointer;');
    expect(baseCss).toContain('cursor: not-allowed;');
    expect(baseCss).toContain('@media (prefers-reduced-motion: reduce)');

    const routerPath = path.join(srcRoot, 'app', 'router.tsx');
    const routerSource = fs.readFileSync(routerPath, 'utf8');
    expect(routerSource).not.toMatch(/from\s+['"][^'"]*data\//);
    expect(routerSource).not.toMatch(/import\s*\(\s*['"][^'"]*data\//);
    expect(routerSource).not.toMatch(/['"]dexie(?:\/[^'"]*)?['"]/);
    expect(routerSource).not.toMatch(/['"]@supabase\/[^'"]*['"]/);
    expect(routerSource).toContain('lazy(');
  });
});
