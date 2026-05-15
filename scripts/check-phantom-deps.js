#!/usr/bin/env node
// Verifies that every @ts-linq/* path alias in a package's tsconfig.json
// is declared in that package's package.json (deps/devDeps/peerDeps).
// Exits with code 1 if any phantom dependency is found.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

const packages = fs.readdirSync(PACKAGES_DIR).filter((name) => {
  const stat = fs.statSync(path.join(PACKAGES_DIR, name));
  return stat.isDirectory();
});

let violations = 0;

for (const pkg of packages) {
  const tsconfigPath = path.join(PACKAGES_DIR, pkg, 'tsconfig.json');
  const pkgJsonPath = path.join(PACKAGES_DIR, pkg, 'package.json');

  if (!fs.existsSync(tsconfigPath) || !fs.existsSync(pkgJsonPath)) continue;

  const tsconfig = readJson(tsconfigPath);
  const pkgJson = readJson(pkgJsonPath);
  if (!tsconfig || !pkgJson) continue;

  const paths = tsconfig.compilerOptions?.paths ?? {};
  const aliases = Object.keys(paths).filter((k) => k.startsWith('@ts-linq/'));
  if (!aliases.length) continue;

  const declared = new Set([
    ...Object.keys(pkgJson.dependencies ?? {}),
    ...Object.keys(pkgJson.devDependencies ?? {}),
    ...Object.keys(pkgJson.peerDependencies ?? {}),
  ]);

  for (const alias of aliases) {
    const pkgName = alias.replace(/\/\*$/, '');
    if (!declared.has(pkgName)) {
      console.error(
        `[phantom-dep] packages/${pkg}: tsconfig path alias "${alias}" is not declared in package.json`
      );
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} phantom dependency violation(s) found.`);
  console.error('Fix: either declare the package in package.json or remove the unused path alias from tsconfig.json.');
  process.exit(1);
} else {
  console.log('Phantom dependency check passed — all tsconfig path aliases are declared in package.json.');
}
