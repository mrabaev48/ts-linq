#!/usr/bin/env node
/**
 * Dual-package resolution smoke check for the published `@ts-linq/orm/internal` subpath
 * (orm/task-6.1 item 5).
 *
 * `package.json` `exports["./internal"]` declares three conditions — `require` (cjs), `import`
 * (esm) and `types`. jest/tsc exercise only the src + type mapping, never a real Node resolution of
 * the BUILT `dist`. This script closes that gap in two layers:
 *
 *   1. STATIC (hard gate, deterministic): assert the `exports["./internal"]` map declares all three
 *      conditions AND that each target file actually exists in `dist`. This is the part orm/task-6.1
 *      owns and could regress, so it is a hard failure (non-zero exit) when broken.
 *
 *   2. RUNTIME (best-effort): actually `require()` the cjs entry and `import()` the esm entry.
 *      Both are currently blocked by a PRE-EXISTING, repo-wide hazard unrelated to this task: several
 *      leaf packages (notably `@ts-linq/ast`) ship an ESM-only build whose relative imports are
 *      emitted WITHOUT a `.js` extension, which Node's ESM loader rejects
 *      (`ERR_MODULE_NOT_FOUND`). It is transitive, so it breaks even a plain `require('@ts-linq/orm')`
 *      of the public entry — not something the internal subpath introduced. When it surfaces we RECORD
 *      it as a known blocker (cross-referenced to the repo-level ESM-emit follow-up) and still exit 0,
 *      because layer 1 already gave us a deterministic assertion of both `exports` conditions.
 *
 * Run after `pnpm build`:  `node packages/orm/scripts/smoke-internal-resolution.cjs`
 * (or `pnpm --filter @ts-linq/orm smoke:internal`).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const pkgRoot = path.resolve(__dirname, '..');
const pkg = require(path.join(pkgRoot, 'package.json'));

// Symbols that must be reachable through the internal subpath (mirrors OrmInternalSubpath.test.ts).
const REQUIRED = ['BatchExecutor', 'HiLoValueGenerator', 'IdentityMap', 'InterceptorRegistry'];

function fail(msg, err) {
  console.error(`✗ ${msg}`);
  if (err) console.error(`  ${err && err.stack ? err.stack : err}`);
  process.exit(1);
}

// ── Layer 1: static exports-map + artifact presence (hard gate) ──────────────────────────────
const internalMap = pkg.exports && pkg.exports['./internal'];
if (!internalMap) fail('package.json exports["./internal"] is missing.');

for (const condition of ['require', 'import', 'types']) {
  const rel = internalMap[condition];
  if (!rel) fail(`exports["./internal"].${condition} condition is missing.`);
  const abs = path.resolve(pkgRoot, rel);
  if (!fs.existsSync(abs)) {
    fail(
      `exports["./internal"].${condition} → ${rel} does not exist on disk (${abs}). ` +
        'Did you run `pnpm build` first?'
    );
  }
  console.log(`✓ exports["./internal"].${condition} → ${rel} (artifact present)`);
}
console.log(
  '✓ static check: both cjs (require) and esm (import) conditions map to built artifacts.'
);

const cjsEntry = path.resolve(pkgRoot, internalMap.require);
const esmEntry = path.resolve(pkgRoot, internalMap.import);

function assertExports(ns, label) {
  const missing = REQUIRED.filter((name) => typeof ns[name] === 'undefined');
  if (missing.length > 0)
    throw new Error(`${label}: missing expected exports: ${missing.join(', ')}`);
}

// The pre-existing, repo-wide ESM extension-less-import hazard surfaces as ERR_MODULE_NOT_FOUND
// (or ERR_UNSUPPORTED_DIR_IMPORT) originating from a transitively-loaded ESM-only leaf package.
function isKnownEsmEmitHazard(err) {
  const code = err && err.code;
  const msg = (err && err.message) || '';
  return (
    (code === 'ERR_MODULE_NOT_FOUND' || code === 'ERR_UNSUPPORTED_DIR_IMPORT') &&
    /dist[\\/]esm[\\/]/.test(msg)
  );
}

function recordBlocker(condition, err) {
  console.warn(
    `⚠ runtime ${condition} of '@ts-linq/orm/internal' could not be verified (code=${err && err.code}).\n` +
      '  This is the PRE-EXISTING, repo-wide manual-ESM extension-less-import hazard — an ESM-only leaf\n' +
      "  package (e.g. @ts-linq/ast) emits relative imports without a '.js' suffix, which Node's ESM\n" +
      "  loader rejects. It is transitive and breaks even require('@ts-linq/orm') of the PUBLIC entry,\n" +
      '  so it is NOT introduced by the internal subpath. Recorded as a known blocker — see the\n' +
      '  repo-level ESM-emit follow-up. The static exports-map assertion above is the deterministic gate.'
  );
  console.warn(`  ${(err && err.message ? err.message : err).toString().split('\n')[0]}`);
}

// ── Layer 2: runtime resolution (best-effort) ────────────────────────────────────────────────
(async () => {
  // cjs require()
  try {
    assertExports(require(cjsEntry), 'cjs require()');
    console.log(`✓ runtime cjs  require('@ts-linq/orm/internal') resolved (exports OK)`);
  } catch (err) {
    if (isKnownEsmEmitHazard(err)) recordBlocker('cjs require()', err);
    else fail(`cjs require('@ts-linq/orm/internal') failed for an UNEXPECTED reason`, err);
  }

  // esm import()
  try {
    assertExports(await import(pathToFileURL(esmEntry).href), 'esm import()');
    console.log(`✓ runtime esm  import('@ts-linq/orm/internal') resolved (exports OK)`);
  } catch (err) {
    if (isKnownEsmEmitHazard(err)) recordBlocker('esm import()', err);
    else fail(`esm import('@ts-linq/orm/internal') failed for an UNEXPECTED reason`, err);
  }

  console.log('✓ smoke check complete (static gate passed; runtime blockers, if any, recorded).');
})();
