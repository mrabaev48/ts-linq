import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression guard (migrations/task-1): no SQL builder may interpolate a bare identifier
 * directly into a dialect quote character. Every identifier must go through the audited
 * {@link SqlQuoter} (via `q()` / `quoter.id()` / `quoter.qualified()`), which escapes
 * embedded quote chars.
 *
 * This complements the scoped ESLint `no-restricted-syntax` rule in
 * `packages/migrations/eslint.config.mjs` with a precise, source-level string check.
 */
const BUILDERS_DIR = join(__dirname, '..', '..', 'src', 'builders');
const QUOTING_DIR = join('quoting'); // the only place allowed to wrap identifiers

/**
 * Matches a quote char used as a SQL delimiter glued to a template interpolation:
 *  - escaped backtick adjacent to `${ … }`  (e.g. \`${name}\`)
 *  - square bracket adjacent to `${ … }`    (e.g. [${name}])
 *  - double quote adjacent to `${ … }`      (e.g. "${name}")
 * Plain template-literal delimiters (`}` followed by an unescaped closing backtick) are
 * NOT matched, because the backtick there is the template terminator, not SQL content.
 */
const RAW_QUOTE_INTERP = /\\`\$\{|\}\\`|\[\$\{|\}\]|"\$\{|\}"/;

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === QUOTING_DIR) continue; // the quoting layer is the sanctioned edge
      out.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('no-raw-quote guard for src/builders', () => {
  const files = collectTsFiles(BUILDERS_DIR);

  test('finds builder source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test.each(files)('%s does not interpolate a bare identifier into a quote char', (file) => {
    const offending = readFileSync(file, 'utf8')
      .split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => RAW_QUOTE_INTERP.test(line));

    expect(offending).toEqual([]);
  });
});
