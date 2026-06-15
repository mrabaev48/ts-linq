import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from '@jest/globals';
import * as ts from 'typescript';

import { buildVisitor } from '../src/CallRewriteVisitor';
import tsLinqTransformer from '../src/index';
import { createWhereTransformer } from '../src/WhereTransformer';

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

/** Minimal @ts-linq/query shim with the exact class names used by the transformer matcher. */
function createTempProject(): {
  readonly entryPath: string;
  writeEntry: (content: string) => void;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-linq-transformer-parity-'));
  const entryPath = path.join(dir, 'consumer.ts');

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
      '}'
    ].join('\n')
  );

  return { entryPath, writeEntry: (content) => writeFile(entryPath, content) };
}

function createProgram(sourceText: string): {
  readonly program: ts.Program;
  readonly sourceFile: ts.SourceFile;
} {
  const project = createTempProject();
  project.writeEntry(sourceText);

  const baseDir = path.dirname(project.entryPath);
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    strict: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    baseUrl: baseDir,
    paths: { '@ts-linq/query': ['packages/query/src/index.ts'] }
  };

  const host = ts.createCompilerHost(options, true);
  const program = ts.createProgram([project.entryPath], options, host);
  const sourceFile = program.getSourceFile(project.entryPath);
  if (!sourceFile) throw new Error('Test setup failed: source file not found in program.');
  return { program, sourceFile };
}

function printWith(
  program: ts.Program,
  sourceFile: ts.SourceFile,
  factory: ts.TransformerFactory<ts.SourceFile>
): string {
  const result = ts.transform(sourceFile, [factory], program.getCompilerOptions());
  const transformed = result.transformed[0];
  if (!transformed || !ts.isSourceFile(transformed))
    throw new Error('Transformer did not return a SourceFile.');
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const output = printer.printFile(transformed);
  result.dispose();
  return output;
}

// ─── Unit: buildVisitor drives the receiver-patch (chained-call) path ─────────

describe('buildVisitor — chained receiver re-rewrite', () => {
  it('.where(...).where(...) — both calls rewritten in one pass', () => {
    const { program, sourceFile } = createProgram(
      [
        "import { Queryable } from '@ts-linq/query';",
        'type User = { id: number; active: boolean };',
        'const q = new Queryable<User>();',
        'q.where(u => u.id > 0).where(u => u.active === true);'
      ].join('\n')
    );

    const checker = program.getTypeChecker();
    const factory: ts.TransformerFactory<ts.SourceFile> = (ctx) => (sf) =>
      ts.visitEachChild(sf, buildVisitor(ctx, checker, undefined), ctx);

    const output = printWith(program, sourceFile, factory);
    const matches = output.match(/whereCompiled/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(2);
  });
});

// ─── Contract: both entrypoints emit byte-for-byte identical AST output ───────

describe('entrypoint parity — tsLinqTransformer vs createWhereTransformer', () => {
  const cases: ReadonlyArray<{ readonly name: string; readonly src: string }> = [
    {
      name: 'single where()',
      src: [
        "import { Queryable } from '@ts-linq/query';",
        'type User = { id: number };',
        'const minId = 1;',
        'const q = new Queryable<User>();',
        'q.where(u => u.id >= minId);'
      ].join('\n')
    },
    {
      name: 'chained where().where()',
      src: [
        "import { Queryable } from '@ts-linq/query';",
        'type User = { id: number; active: boolean };',
        'const q = new Queryable<User>();',
        'q.where(u => u.id > 0).where(u => u.active === true);'
      ].join('\n')
    },
    {
      name: 'select()',
      src: [
        "import { Queryable } from '@ts-linq/query';",
        'type User = { id: number; name: string };',
        'const q = new Queryable<User>();',
        'q.select(e => ({ id: e.id, name: e.name }));'
      ].join('\n')
    },
    {
      name: 'having()',
      src: [
        "import { Queryable } from '@ts-linq/query';",
        'type Order = { total: number };',
        'const minTotal = 100;',
        'const q = new Queryable<Order>();',
        'q.having(o => o.total >= minTotal);'
      ].join('\n')
    }
  ];

  for (const { name, src } of cases) {
    it(`produces identical output for: ${name}`, () => {
      const { program, sourceFile } = createProgram(src);

      const fromDefault = printWith(program, sourceFile, tsLinqTransformer(program, {}));
      const fromInjected = printWith(
        program,
        sourceFile,
        createWhereTransformer(program, { addDiagnostic: () => {} })
      );

      expect(fromInjected).toBe(fromDefault);
      // Sanity: the rewrite actually happened (not two identical no-ops).
      expect(fromDefault).toContain('Compiled');
    });
  }
});
