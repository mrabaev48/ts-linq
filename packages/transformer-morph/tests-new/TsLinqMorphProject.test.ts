import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from '@jest/globals';
import { ValidationError } from '@ts-linq/types';
import * as ts from 'typescript';

import { TS_LINQ_DIAGNOSTIC_CODE } from '../src/core';
import { TsLinqMorphProject } from '../src/TsLinqMorphProject';
import { createFixtureProject } from './helpers';

const BRANDED_CONSUMER = [
  "import { Queryable } from '@ts-linq/query';",
  '',
  '// leading comment that must survive the transform untouched',
  'type User = { id: number; isActive: boolean; profile: { age: number } };',
  '',
  'const minAge = 21;',
  'const q = new Queryable<User>();',
  'q.where(u => u.profile.age >= minAge);'
].join('\n');

describe('TsLinqMorphProject — construction', () => {
  it('throws ValidationError when the tsconfig does not exist', () => {
    expect(
      () => new TsLinqMorphProject({ tsConfigFilePath: '/nonexistent/dir/tsconfig.json' })
    ).toThrow(ValidationError);
  });
});

describe('TsLinqMorphProject — transformSources', () => {
  it('rewrites where(...) on a branded receiver to whereCompiled(...)', () => {
    const fixture = createFixtureProject(BRANDED_CONSUMER);
    const project = new TsLinqMorphProject({ tsConfigFilePath: fixture.tsConfigFilePath });

    const result = project.transformSources();

    expect(result.diagnostics).toHaveLength(0);
    const consumer = result.files.find((f) => f.fileName.endsWith('consumer.ts'));
    expect(consumer).toBeDefined();
    expect(consumer!.changed).toBe(true);
    expect(consumer!.text).toContain('whereCompiled');
    expect(consumer!.text).toContain('parameters: [minAge]');
    expect(consumer!.text).not.toContain('u.profile.age >= minAge');
  });

  it('preserves untouched statements and comments byte-for-byte', () => {
    const fixture = createFixtureProject(BRANDED_CONSUMER);
    const project = new TsLinqMorphProject({ tsConfigFilePath: fixture.tsConfigFilePath });

    const consumer = project
      .transformSources()
      .files.find((f) => f.fileName.endsWith('consumer.ts'));

    expect(consumer!.text).toContain(
      '// leading comment that must survive the transform untouched'
    );
    expect(consumer!.text).toContain(
      'type User = { id: number; isActive: boolean; profile: { age: number } };'
    );
    expect(consumer!.text).toContain('const q = new Queryable<User>();');
  });

  it('leaves unbranded receivers untouched', () => {
    const fixture = createFixtureProject(
      [
        'const q = { where: (fn: (u: { id: number }) => boolean) => q };',
        'q.where(u => u.id > 1);'
      ].join('\n')
    );
    const project = new TsLinqMorphProject({ tsConfigFilePath: fixture.tsConfigFilePath });

    const result = project.transformSources();

    const consumer = result.files.find((f) => f.fileName.endsWith('consumer.ts'));
    expect(consumer!.changed).toBe(false);
    expect(consumer!.text).not.toContain('whereCompiled');
  });

  it('collects transform diagnostics for unsupported expressions', () => {
    const fixture = createFixtureProject(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type User = { id: number };',
        '',
        'const q = new Queryable<User>();',
        'q.where(u => (u.id + 1) > 0);'
      ].join('\n')
    );
    const project = new TsLinqMorphProject({ tsConfigFilePath: fixture.tsConfigFilePath });

    const result = project.transformSources();

    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]!.code).toBe(TS_LINQ_DIAGNOSTIC_CODE);
    const message = ts.flattenDiagnosticMessageText(result.diagnostics[0]!.messageText, '\n');
    expect(message).toContain('is not supported');
  });
});

describe('TsLinqMorphProject — emit', () => {
  it('emits JavaScript with the rewrite applied (tspc replacement)', () => {
    const fixture = createFixtureProject(BRANDED_CONSUMER);
    const project = new TsLinqMorphProject({ tsConfigFilePath: fixture.tsConfigFilePath });

    expect(project.getPreEmitDiagnostics()).toHaveLength(0);
    const result = project.emit();

    expect(result.emitSkipped).toBe(false);
    expect(result.transformDiagnostics).toHaveLength(0);
    expect(result.emitDiagnostics).toHaveLength(0);

    const emittedJs = fixture.readOutput('dist/consumer.js');
    expect(emittedJs).toContain('whereCompiled');
    expect(emittedJs).toContain('parameters: [minAge]');
    expect(emittedJs).not.toContain('.where(');
  });
});

describe('TsLinqMorphProject — analyze', () => {
  it('reports branded and unbranded call sites', () => {
    const fixture = createFixtureProject(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type User = { id: number };',
        'const branded = new Queryable<User>();',
        'branded.where(u => u.id > 1);',
        '',
        'const plain = { where: (fn: (u: { id: number }) => boolean) => plain };',
        'plain.where(u => u.id > 1);'
      ].join('\n')
    );
    const project = new TsLinqMorphProject({ tsConfigFilePath: fixture.tsConfigFilePath });

    const candidates = project.analyze();
    const consumerCandidates = candidates.filter((c) => c.filePath.endsWith('consumer.ts'));

    expect(consumerCandidates).toHaveLength(2);
    const brandedCandidate = consumerCandidates.find((c) => c.receiverText === 'branded');
    const plainCandidate = consumerCandidates.find((c) => c.receiverText === 'plain');
    expect(brandedCandidate?.receiverIsBranded).toBe(true);
    expect(brandedCandidate?.methodName).toBe('where');
    expect(brandedCandidate?.line).toBe(5);
    expect(plainCandidate?.receiverIsBranded).toBe(false);
  });
});

describe('TsLinqMorphProject — writeTransformedSources', () => {
  it('mirrors the transformed source tree into outDir', () => {
    const fixture = createFixtureProject(BRANDED_CONSUMER);
    const project = new TsLinqMorphProject({ tsConfigFilePath: fixture.tsConfigFilePath });
    const outDir = path.join(fixture.dir, 'transformed-src');

    project.writeTransformedSources({ outDir });

    const consumerOut = fs.readFileSync(path.join(outDir, 'consumer.ts'), 'utf8');
    expect(consumerOut).toContain('whereCompiled');
    const shimOut = fs.readFileSync(path.join(outDir, 'packages/query/src/index.ts'), 'utf8');
    expect(shimOut).toContain('__tsLinqWhereTransformerBrand');
  });

  it('overwrite mode rewrites only changed files in place', () => {
    const fixture = createFixtureProject(BRANDED_CONSUMER);
    const project = new TsLinqMorphProject({ tsConfigFilePath: fixture.tsConfigFilePath });
    const shimPath = path.join(fixture.dir, 'packages/query/src/index.ts');
    const shimBefore = fs.readFileSync(shimPath, 'utf8');
    const shimMtimeBefore = fs.statSync(shimPath).mtimeMs;

    project.writeTransformedSources({ overwrite: true });

    expect(fs.readFileSync(fixture.consumerPath, 'utf8')).toContain('whereCompiled');
    expect(fs.readFileSync(shimPath, 'utf8')).toBe(shimBefore);
    expect(fs.statSync(shimPath).mtimeMs).toBe(shimMtimeBefore);
  });
});
