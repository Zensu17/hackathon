import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');
const srcRoot = path.resolve(repoRoot, 'src').replace(/\\/g, '/');

type CheckedLayer = 'domain' | 'application' | 'presentation';

const FORBIDDEN_GLOBALS_PATTERN =
  /(?<!\.)\b(window|document|navigator|localStorage|sessionStorage|indexedDB|File|Blob)\b|import\.meta\b|process\.env\b/;

const EM_DASH = '\u2014';
const EN_DASH = '\u2013';

// Strip JS/TS comments while keeping string literals intact so import specifiers remain parseable.
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  let mode: 'code' | 'single' | 'double' | 'template' | 'line_comment' | 'block_comment' = 'code';

  while (i < source.length) {
    const ch = source[i] ?? '';
    const next = source[i + 1] ?? '';

    if (mode === 'code') {
      if (ch === '/' && next === '/') {
        mode = 'line_comment';
        out += '  ';
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        mode = 'block_comment';
        out += '  ';
        i += 2;
        continue;
      }
      if (ch === "'") {
        mode = 'single';
      } else if (ch === '"') {
        mode = 'double';
      } else if (ch === '`') {
        mode = 'template';
      }
      out += ch;
      i += 1;
      continue;
    }

    if (mode === 'line_comment') {
      if (ch === '\n') {
        mode = 'code';
        out += '\n';
      } else {
        out += ' ';
      }
      i += 1;
      continue;
    }

    if (mode === 'block_comment') {
      if (ch === '*' && next === '/') {
        mode = 'code';
        out += '  ';
        i += 2;
        continue;
      }
      out += ch === '\n' ? '\n' : ' ';
      i += 1;
      continue;
    }

    if (ch === '\\') {
      out += ch + next;
      i += 2;
      continue;
    }

    if (
      (mode === 'single' && ch === "'") ||
      (mode === 'double' && ch === '"') ||
      (mode === 'template' && ch === '`')
    ) {
      mode = 'code';
    }
    out += ch;
    i += 1;
  }

  return out;
}

// Blank out string literal contents so error messages mentioning "File" do not trigger global checks.
function stripStringsFromCommentFreeCode(commentFreeSource: string): string {
  let out = '';
  let i = 0;
  let quote: "'" | '"' | '`' | null = null;

  while (i < commentFreeSource.length) {
    const ch = commentFreeSource[i] ?? '';

    if (quote === null) {
      if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch;
        out += ch;
      } else {
        out += ch;
      }
      i += 1;
      continue;
    }

    if (ch === '\\') {
      out += '  ';
      i += 2;
      continue;
    }

    if (ch === quote) {
      quote = null;
      out += ch;
    } else {
      out += ch === '\n' ? '\n' : ' ';
    }
    i += 1;
  }

  return out;
}

function extractModuleSpecifiers(commentFreeSource: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null = pattern.exec(commentFreeSource);
    while (match !== null) {
      if (match[1]) {
        specifiers.push(match[1]);
      }
      match = pattern.exec(commentFreeSource);
    }
  }

  return specifiers;
}

function isWithinDir(candidateNormalized: string, dirNormalized: string): boolean {
  return (
    candidateNormalized === dirNormalized || candidateNormalized.startsWith(`${dirNormalized}/`)
  );
}

export function analyzeFileBoundaries(
  filePath: string,
  source: string,
  layer: CheckedLayer,
): string[] {
  const violations: string[] = [];
  const normalizedFile = path.resolve(filePath).replace(/\\/g, '/');
  const relativeLabel = path.relative(repoRoot, normalizedFile).replace(/\\/g, '/');
  const commentFree = stripComments(source);
  const specifiers = extractModuleSpecifiers(commentFree);

  for (const specifier of specifiers) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../');

    if (isRelative) {
      const resolved = path
        .resolve(path.dirname(normalizedFile), specifier)
        .replace(/\\/g, '/')
        .replace(/\.(ts|tsx|js|jsx|css)$/, '');

      if (layer === 'domain') {
        if (!isWithinDir(resolved, `${srcRoot}/domain`)) {
          violations.push(
            `${relativeLabel}: domain cannot import outside src/domain (found '${specifier}' -> '${resolved}')`,
          );
        }
      } else if (layer === 'application') {
        const allowed =
          isWithinDir(resolved, `${srcRoot}/domain`) ||
          isWithinDir(resolved, `${srcRoot}/application`);
        if (!allowed) {
          violations.push(
            `${relativeLabel}: application can only import src/domain or src/application (found '${specifier}' -> '${resolved}')`,
          );
        }
      } else if (layer === 'presentation') {
        if (isWithinDir(resolved, `${srcRoot}/data`)) {
          violations.push(
            `${relativeLabel}: presentation cannot import src/data (found '${specifier}' -> '${resolved}')`,
          );
        }
      }
    } else {
      if (layer === 'domain' || layer === 'application') {
        violations.push(
          `${relativeLabel}: ${layer} cannot import external package '${specifier}'`,
        );
      } else if (layer === 'presentation') {
        const isForbiddenSdk =
          specifier === 'dexie' ||
          specifier.startsWith('dexie/') ||
          specifier === '@supabase/supabase-js' ||
          specifier.startsWith('@supabase/');
        if (isForbiddenSdk) {
          violations.push(
            `${relativeLabel}: presentation cannot import data SDK '${specifier}'`,
          );
        }
      }
    }
  }

  if (layer === 'domain' || layer === 'application') {
    const codeOnly = stripStringsFromCommentFreeCode(commentFree);
    const globalMatch = FORBIDDEN_GLOBALS_PATTERN.exec(codeOnly);
    if (globalMatch) {
      violations.push(
        `${relativeLabel}: ${layer} cannot reference browser/runtime global '${globalMatch[0]}'`,
      );
    }
  }

  return violations;
}

function collectFiles(dirPath: string, extensions: readonly string[]): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const results: string[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, extensions));
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Clean Architecture boundaries and Antislop R-02 copy hygiene', () => {
  it('enforces pure inward-only imports and zero browser globals in src/domain', () => {
    const files = collectFiles(path.join(srcRoot, 'domain'), ['.ts', '.tsx']);
    const violations = files.flatMap((file) =>
      analyzeFileBoundaries(file, fs.readFileSync(file, 'utf8'), 'domain'),
    );
    expect(violations).toEqual([]);
  });

  it('enforces pure domain/application-only imports and zero browser globals in src/application', () => {
    const files = collectFiles(path.join(srcRoot, 'application'), ['.ts', '.tsx']);
    const violations = files.flatMap((file) =>
      analyzeFileBoundaries(file, fs.readFileSync(file, 'utf8'), 'application'),
    );
    expect(violations).toEqual([]);
  });

  it('prevents src/presentation from importing src/data, dexie, or @supabase/supabase-js', () => {
    const files = collectFiles(path.join(srcRoot, 'presentation'), ['.ts', '.tsx']);
    const violations = files.flatMap((file) =>
      analyzeFileBoundaries(file, fs.readFileSync(file, 'utf8'), 'presentation'),
    );
    expect(violations).toEqual([]);
  });

  it('detects parent-traversal, external SDK, and browser-global violations accurately', () => {
    const domainFile = path.join(srcRoot, 'domain', 'rules', 'sample.ts');
    expect(
      analyzeFileBoundaries(
        domainFile,
        `import { db } from '../../data/local/LiteLearnDb';`,
        'domain',
      ),
    ).toHaveLength(1);
    expect(
      analyzeFileBoundaries(domainFile, `import React from 'react';`, 'domain'),
    ).toHaveLength(1);
    expect(
      analyzeFileBoundaries(
        domainFile,
        `export const token = localStorage.getItem('x');`,
        'domain',
      ),
    ).toHaveLength(1);

    const appFile = path.join(srcRoot, 'application', 'usecases', 'sample.ts');
    expect(
      analyzeFileBoundaries(appFile, `import type { User } from '../../domain/entities/User';`, 'application'),
    ).toEqual([]);
    expect(
      analyzeFileBoundaries(appFile, `import Dexie from 'dexie';`, 'application'),
    ).toHaveLength(1);

    const uiFile = path.join(srcRoot, 'presentation', 'pages', 'HomePage.tsx');
    expect(
      analyzeFileBoundaries(uiFile, `import { useAppContainer } from '../../app/di';`, 'presentation'),
    ).toEqual([]);
    expect(
      analyzeFileBoundaries(
        uiFile,
        `import { seed } from '../../data/local/seed';`,
        'presentation',
      ),
    ).toHaveLength(1);
    expect(
      analyzeFileBoundaries(
        uiFile,
        `import { createClient } from '@supabase/supabase-js';`,
        'presentation',
      ),
    ).toHaveLength(1);
  });

  it('contains zero forbidden em dashes or en dashes across src/ and index.html (R-02)', () => {
    const files = [
      path.join(repoRoot, 'index.html'),
      ...collectFiles(srcRoot, ['.ts', '.tsx', '.css', '.html']),
    ];
    const dashViolations: string[] = [];

    for (const file of files) {
      if (!fs.existsSync(file)) {
        continue;
      }
      const content = fs.readFileSync(file, 'utf8');
      const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
      if (content.includes(EM_DASH)) {
        dashViolations.push(`${rel}: contains forbidden em dash`);
      }
      if (content.includes(EN_DASH)) {
        dashViolations.push(`${rel}: contains forbidden en dash`);
      }
    }

    expect(dashViolations).toEqual([]);
  });
});
