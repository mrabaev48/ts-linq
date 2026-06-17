/**
 * CI gate against the class of defect fixed in refactor orm/task-2: empty `catch`
 * blocks and commented-out `logInternalError` calls in shipped source.
 *
 * This is a belt-and-suspenders companion to the scoped ESLint rule
 * (`packages/orm/eslint.config.mjs`, `no-restricted-syntax` on empty catch). It
 * stays green even if the lint config drifts, and additionally forbids the
 * commented-out logging markers that signalled the original unfinished migration.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from '@jest/globals';

const SRC_ROOT = join(__dirname, '..', 'src');

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

// Empty catch: `catch {` or `catch (e) {` immediately followed (ignoring
// whitespace and a single-line/block comment) by the closing `}`.
const EMPTY_CATCH = /catch\s*(\([^)]*\))?\s*\{\s*(\/\/[^\n]*\s*|\/\*[\s\S]*?\*\/\s*)?\}/;
const COMMENTED_LOGGER = /\/\/\s*logInternalError/;

describe('orm/task-2 — no empty catch / commented loggers in src', () => {
  const files = collectTsFiles(SRC_ROOT);

  it('finds source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('contains no empty catch blocks', () => {
    const offenders = files.filter((f) => EMPTY_CATCH.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('contains no commented-out logInternalError calls', () => {
    const offenders = files.filter((f) => COMMENTED_LOGGER.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
