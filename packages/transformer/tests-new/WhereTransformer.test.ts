import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from '@jest/globals';
import * as ts from 'typescript';

import { TS_LINQ_DIAGNOSTIC_CODE } from '../src/diagnostics/DiagnosticSink';
import { createWhereTransformer } from '../src/WhereTransformer';

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createTempProject(): {
  readonly dir: string;
  readonly entryPath: string;
  writeEntry: (content: string) => void;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-linq-transformer-'));
  const entryPath = path.join(dir, 'consumer.ts');

  // Minimal @ts-linq/query shim with the exact class names used by the transformer matcher.
  writeFile(
    path.join(dir, 'packages/query/src/index.ts'),
    [
      'export class Queryable<T> {',
      '  declare readonly __tsLinqWhereTransformerBrand: true;',
      '  public where(predicate: (entity: T) => boolean): Queryable<T> { void predicate; return this; }',
      '  public whereCompiled(input: { ast: unknown; parameters: readonly unknown[] }): Queryable<T> { void input; return this; }',
      '  public having(predicate: (entity: T) => boolean): Queryable<T> { void predicate; return this; }',
      '  public havingCompiled(input: { ast: unknown; parameters: readonly unknown[] }): Queryable<T> { void input; return this; }',
      '  public select<R>(selector: (entity: T) => R): Queryable<R> { void selector; return this as unknown as Queryable<R>; }',
      '  public selectCompiled<R>(input: { fields: readonly string[] }): Queryable<R> { void input; return this as unknown as Queryable<R>; }',
      '}',
      'export class TypedQueryable<T> {',
      '  declare readonly __tsLinqWhereTransformerBrand: true;',
      '  public where(predicate: (entity: T) => boolean): TypedQueryable<T> { void predicate; return this; }',
      '  public whereCompiled(input: { ast: unknown; parameters: readonly unknown[] }): TypedQueryable<T> { void input; return this; }',
      '}'
    ].join('\n')
  );

  return {
    dir,
    entryPath,
    writeEntry: (content) => writeFile(entryPath, content)
  };
}

function compileAndTransform(sourceText: string): {
  readonly outputText: string;
  readonly diagnostics: readonly ts.Diagnostic[];
} {
  const project = createTempProject();
  project.writeEntry(sourceText);

  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    strict: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    baseUrl: project.dir,
    paths: {
      '@ts-linq/query': ['packages/query/src/index.ts']
    }
  };

  const host = ts.createCompilerHost(options, true);
  const program = ts.createProgram([project.entryPath], options, host);
  const sourceFile = program.getSourceFile(project.entryPath);
  if (!sourceFile) {
    throw new Error('Test setup failed: source file not found in program.');
  }

  const diags: ts.Diagnostic[] = [];
  const transformer = createWhereTransformer(program, {
    addDiagnostic: (d: ts.Diagnostic) => {
      diags.push(d);
    }
  });

  const result = ts.transform(sourceFile, [transformer], program.getCompilerOptions());
  const transformed = result.transformed[0];
  if (!transformed || !ts.isSourceFile(transformed)) {
    throw new Error('Transformer did not return a SourceFile.');
  }

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const outputText = printer.printFile(transformed);
  result.dispose();
  return { outputText, diagnostics: diags };
}

// ─── Original tests (preserved) ──────────────────────────────────────────────

describe('WhereTransformer', () => {
  it('rewrites Queryable.where(...) to whereCompiled(...) with captured parameters', () => {
    const { outputText, diagnostics } = compileAndTransform(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type User = { id: number; isActive: boolean; profile: { age: number } };',
        '',
        'const minAge = 21;',
        'const q = new Queryable<User>();',
        'q.where(u => u.profile.age >= minAge);'
      ].join('\n')
    );

    expect(diagnostics).toHaveLength(0);
    expect(outputText).toContain('whereCompiled');
    expect(outputText).toMatch(/type:\s*["']parameterRef["']/);
    expect(outputText).toContain('parameters: [minAge]');
  });

  it('rewrites TypedQueryable.where(...) to whereCompiled(...)', () => {
    const { outputText, diagnostics } = compileAndTransform(
      [
        "import { TypedQueryable } from '@ts-linq/query';",
        '',
        'type User = { id: number };',
        '',
        'const q = new TypedQueryable<User>();',
        'q.where(u => u.id === 1);'
      ].join('\n')
    );

    expect(diagnostics).toHaveLength(0);
    expect(outputText).toContain('whereCompiled');
    expect(outputText).toMatch(/type:\s*["']binary["']/);
  });

  it('emits diagnostics for unsupported operators', () => {
    const { diagnostics } = compileAndTransform(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type User = { id: number };',
        '',
        'const q = new Queryable<User>();',
        'q.where(u => (u.id + 1) > 0);'
      ].join('\n')
    );

    expect(diagnostics.length).toBeGreaterThan(0);
    const msg = ts.flattenDiagnosticMessageText(diagnostics[0]!.messageText, '\n');
    expect(msg).toContain('is not supported');
  });
});

// ─── Extended integration tests ───────────────────────────────────────────────

describe('WhereTransformer — having() rewrite', () => {
  it('rewrites having(...) to havingCompiled(...)', () => {
    const { outputText, diagnostics } = compileAndTransform(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type Order = { total: number };',
        '',
        'const minTotal = 100;',
        'const q = new Queryable<Order>();',
        'q.having(o => o.total >= minTotal);'
      ].join('\n')
    );

    expect(diagnostics).toHaveLength(0);
    expect(outputText).toContain('havingCompiled');
    expect(outputText).toContain('parameters: [minTotal]');
  });
});

describe('WhereTransformer — select() rewrite', () => {
  it('object literal form → selectCompiled with fields array', () => {
    const { outputText, diagnostics } = compileAndTransform(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type User = { id: number; name: string };',
        '',
        'const q = new Queryable<User>();',
        'q.select(e => ({ id: e.id, name: e.name }));'
      ].join('\n')
    );

    expect(diagnostics).toHaveLength(0);
    expect(outputText).toContain('selectCompiled');
    expect(outputText).toContain('"id"');
    expect(outputText).toContain('"name"');
    expect(outputText).toContain('fields');
  });

  it('single property form → selectCompiled with one field', () => {
    const { outputText, diagnostics } = compileAndTransform(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type User = { id: number };',
        '',
        'const q = new Queryable<User>();',
        'q.select(e => e.id);'
      ].join('\n')
    );

    expect(diagnostics).toHaveLength(0);
    expect(outputText).toContain('selectCompiled');
    expect(outputText).toContain('"id"');
  });

  it('block body → emits diagnostic', () => {
    const { diagnostics } = compileAndTransform(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type User = { id: number };',
        '',
        'const q = new Queryable<User>();',
        'q.select(e => { return e.id; });'
      ].join('\n')
    );

    expect(diagnostics.length).toBeGreaterThan(0);
    const msg = ts.flattenDiagnosticMessageText(diagnostics[0]!.messageText, '\n');
    expect(msg).toContain('block statement');
  });
});

describe('WhereTransformer — chained calls', () => {
  it('.where(...).where(...) — both rewrites fire', () => {
    const { outputText, diagnostics } = compileAndTransform(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type User = { id: number; active: boolean };',
        '',
        'const q = new Queryable<User>();',
        'q.where(u => u.id > 0).where(u => u.active === true);'
      ].join('\n')
    );

    expect(diagnostics).toHaveLength(0);
    // Both where() calls should be rewritten
    const matches = outputText.match(/whereCompiled/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});

describe('WhereTransformer — deeply nested property access', () => {
  it('u.a.b.c.d.e → PropertyNode with multi-segment path', () => {
    const { outputText, diagnostics } = compileAndTransform(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type User = { a: { b: { c: { d: { e: number } } } } };',
        '',
        'const q = new Queryable<User>();',
        'q.where(u => u.a.b.c.d.e === 1);'
      ].join('\n')
    );

    expect(diagnostics).toHaveLength(0);
    expect(outputText).toContain('whereCompiled');
    expect(outputText).toContain('"a"');
    expect(outputText).toContain('"e"');
  });
});

describe('WhereTransformer — multiple external variable capture', () => {
  it('two external vars → ParameterRefNode with indices 0 and 1', () => {
    const { outputText, diagnostics } = compileAndTransform(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type User = { age: number; score: number };',
        '',
        'const minAge = 18;',
        'const minScore = 50;',
        'const q = new Queryable<User>();',
        'q.where(u => u.age >= minAge && u.score >= minScore);'
      ].join('\n')
    );

    expect(diagnostics).toHaveLength(0);
    expect(outputText).toContain('parameters: [minAge, minScore]');
    // Should have parameterRef with index 0 and index 1
    expect(outputText).toMatch(/index:\s*0/);
    expect(outputText).toMatch(/index:\s*1/);
  });
});

describe('WhereTransformer — diagnostic code', () => {
  it('always emits diagnostics with code 90001', () => {
    const { diagnostics } = compileAndTransform(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type User = { id: number };',
        '',
        'const q = new Queryable<User>();',
        'q.where(u => u.id ? true : false);'
      ].join('\n')
    );

    expect(diagnostics.length).toBeGreaterThan(0);
    for (const d of diagnostics) {
      expect(d.code).toBe(TS_LINQ_DIAGNOSTIC_CODE);
    }
  });
});

describe('WhereTransformer — hasQueryFilter() rewrite (P0-11)', () => {
  function createTempProjectWithBuilder(): {
    readonly dir: string;
    readonly entryPath: string;
    writeEntry: (content: string) => void;
  } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-linq-transformer-builder-'));
    const entryPath = path.join(dir, 'consumer.ts');

    writeFile(
      path.join(dir, 'packages/query/src/index.ts'),
      [
        'export class Queryable<T> {',
        '  declare readonly __tsLinqWhereTransformerBrand: true;',
        '  public where(predicate: (entity: T) => boolean): Queryable<T> { void predicate; return this; }',
        '  public whereCompiled(input: { ast: unknown; parameters: readonly unknown[] }): Queryable<T> { void input; return this; }',
        '}'
      ].join('\n')
    );

    writeFile(
      path.join(dir, 'packages/orm/src/index.ts'),
      [
        'export class EntityTypeBuilder<T> {',
        '  declare readonly __tsLinqEntityTypeBuilderBrand: true;',
        '  hasQueryFilter(predicate: (e: T) => boolean): this;',
        '  hasQueryFilter(name: string, predicate: (e: T) => boolean): this;',
        '  hasQueryFilter(_n: string | ((e: T) => boolean), _p?: (e: T) => boolean): this { return this; }',
        '  hasQueryFilterCompiled(n: string | { ast: unknown; parameters: readonly unknown[] }, c?: { ast: unknown; parameters: readonly unknown[] }): this { void n; void c; return this; }',
        '}'
      ].join('\n')
    );

    return {
      dir,
      entryPath,
      writeEntry: (content) => writeFile(entryPath, content)
    };
  }

  function compileAndTransformWithBuilder(sourceText: string): {
    readonly outputText: string;
    readonly diagnostics: readonly ts.Diagnostic[];
  } {
    const project = createTempProjectWithBuilder();
    project.writeEntry(sourceText);

    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      baseUrl: project.dir,
      paths: {
        '@ts-linq/query': ['packages/query/src/index.ts'],
        '@ts-linq/orm': ['packages/orm/src/index.ts']
      }
    };

    const host = ts.createCompilerHost(options, true);
    const program = ts.createProgram([project.entryPath], options, host);
    const sourceFile = program.getSourceFile(project.entryPath);
    if (!sourceFile) throw new Error('Test setup failed: source file not found in program.');

    const diags: ts.Diagnostic[] = [];
    const transformer = createWhereTransformer(program, {
      addDiagnostic: (d: ts.Diagnostic) => {
        diags.push(d);
      }
    });

    const result = ts.transform(sourceFile, [transformer], program.getCompilerOptions());
    const transformed = result.transformed[0];
    if (!transformed || !ts.isSourceFile(transformed)) throw new Error('No SourceFile returned.');

    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const outputText = printer.printFile(transformed);
    result.dispose();
    return { outputText, diagnostics: diags };
  }

  it('rewrites unnamed hasQueryFilter(pred) → hasQueryFilterCompiled({ ast, parameters })', () => {
    const { outputText, diagnostics } = compileAndTransformWithBuilder(
      [
        "import { EntityTypeBuilder } from '@ts-linq/orm';",
        '',
        'type Post = { isDeleted: boolean };',
        '',
        'const b = new EntityTypeBuilder<Post>();',
        'b.hasQueryFilter(p => !p.isDeleted);'
      ].join('\n')
    );

    expect(diagnostics).toHaveLength(0);
    expect(outputText).toContain('hasQueryFilterCompiled');
    expect(outputText).not.toContain('hasQueryFilter(');
    expect(outputText).toMatch(/type:\s*["']not["']/);
  });

  it('rewrites named hasQueryFilter(name, pred) → hasQueryFilterCompiled(name, { ast, parameters })', () => {
    const { outputText, diagnostics } = compileAndTransformWithBuilder(
      [
        "import { EntityTypeBuilder } from '@ts-linq/orm';",
        '',
        'type Post = { isDeleted: boolean };',
        '',
        'const b = new EntityTypeBuilder<Post>();',
        'b.hasQueryFilter("softDelete", p => !p.isDeleted);'
      ].join('\n')
    );

    expect(diagnostics).toHaveLength(0);
    expect(outputText).toContain('hasQueryFilterCompiled');
    expect(outputText).toContain('"softDelete"');
    expect(outputText).toMatch(/type:\s*["']not["']/);
  });

  it('captures external variable as parameterRef in hasQueryFilter', () => {
    const { outputText, diagnostics } = compileAndTransformWithBuilder(
      [
        "import { EntityTypeBuilder } from '@ts-linq/orm';",
        '',
        'type Post = { tenantId: string };',
        '',
        'const currentTenant = "acme";',
        'const b = new EntityTypeBuilder<Post>();',
        'b.hasQueryFilter(p => p.tenantId === currentTenant);'
      ].join('\n')
    );

    expect(diagnostics).toHaveLength(0);
    expect(outputText).toContain('hasQueryFilterCompiled');
    expect(outputText).toContain('parameters: [currentTenant]');
  });

  it('unsupported expression names hasQueryFilter(), not where()', () => {
    const { diagnostics } = compileAndTransformWithBuilder(
      [
        "import { EntityTypeBuilder } from '@ts-linq/orm';",
        '',
        'type Post = { isDeleted: boolean; total: number };',
        '',
        'const b = new EntityTypeBuilder<Post>();',
        'b.hasQueryFilter(p => p.isDeleted ? p.total : 0);'
      ].join('\n')
    );

    expect(diagnostics.length).toBeGreaterThan(0);
    const msg = ts.flattenDiagnosticMessageText(diagnostics[0]!.messageText, '\n');
    expect(msg.startsWith('hasQueryFilter() predicate')).toBe(true);
    expect(msg).toContain('unsupported expression');
    expect(msg).not.toContain('where()');
  });
});

// ─── Method-aware unsupported-expression diagnostics (task-2) ──────────────────

describe('WhereTransformer — method-aware unsupported-expression diagnostics', () => {
  it('having() unsupported expression names having(), not where()', () => {
    const { diagnostics } = compileAndTransform(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type Order = { flag: boolean; total: number };',
        '',
        'const q = new Queryable<Order>();',
        'q.having(o => o.flag ? o.total : 0);'
      ].join('\n')
    );

    expect(diagnostics.length).toBeGreaterThan(0);
    const msg = ts.flattenDiagnosticMessageText(diagnostics[0]!.messageText, '\n');
    expect(msg.startsWith('having() predicate')).toBe(true);
    expect(msg).toContain('unsupported expression');
    expect(msg).not.toContain('where()');
  });

  it('where() unsupported expression still names where() (regression)', () => {
    const { diagnostics } = compileAndTransform(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type Order = { flag: boolean; total: number };',
        '',
        'const q = new Queryable<Order>();',
        'q.where(o => o.flag ? o.total : 0);'
      ].join('\n')
    );

    expect(diagnostics.length).toBeGreaterThan(0);
    const msg = ts.flattenDiagnosticMessageText(diagnostics[0]!.messageText, '\n');
    expect(msg.startsWith('where() predicate')).toBe(true);
    expect(msg).toContain('unsupported expression');
  });
});
