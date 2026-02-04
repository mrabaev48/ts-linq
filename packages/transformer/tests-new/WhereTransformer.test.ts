import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from '@jest/globals';
import * as ts from 'typescript';

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
      "export class Queryable<T> {",
      "  public where(predicate: (entity: T) => boolean): Queryable<T> { void predicate; return this; }",
      "  public whereCompiled(input: { ast: unknown; parameters: readonly unknown[] }): Queryable<T> { void input; return this; }",
      "  public having(predicate: (entity: T) => boolean): Queryable<T> { void predicate; return this; }",
      "  public havingCompiled(input: { ast: unknown; parameters: readonly unknown[] }): Queryable<T> { void input; return this; }",
      "}",
      "export class TypedQueryable<T> {",
      "  public where(predicate: (entity: T) => boolean): TypedQueryable<T> { void predicate; return this; }",
      "  public whereCompiled(input: { ast: unknown; parameters: readonly unknown[] }): TypedQueryable<T> { void input; return this; }",
      "}"
    ].join('\n')
  );

  // Minimal @ts-linq/ast shim: only exports the enums the transformer injects.
  writeFile(
    path.join(dir, 'packages/ast/src/index.ts'),
    [
      "export enum LogicalOperator { And = 'AND', Or = 'OR' }",
      "export enum ComparisonOperator { Eq = '=', Gt = '>', Gte = '>=', Lt = '<', Lte = '<=' }",
      "export enum UnaryOperator { Not = 'NOT' }",
      "export class SqlVisitor {}"
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
      '@ts-linq/query': ['packages/query/src/index.ts'],
      '@ts-linq/ast': ['packages/ast/src/index.ts']
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

describe('WhereTransformer', () => {
  it('rewrites Queryable.where(...) to whereCompiled(...) and injects @ts-linq/ast imports', () => {
    const { outputText, diagnostics } = compileAndTransform(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type User = { id: number; isActive: boolean; profile: { age: number } };',
        '',
        'const minAge = 21;',
        'const q = new Queryable<User>();',
        'q.where(u => u.profile.age >= minAge && !u.isActive);'
      ].join('\n')
    );

    expect(diagnostics).toHaveLength(0);
    expect(outputText).toContain('whereCompiled');
    expect(outputText).toMatch(/from ['"]@ts-linq\/ast['"]/);
    expect(outputText).toMatch(/type:\s*['"]ParameterRef['"]/);
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
  });

  it("emits diagnostics for unsupported operator '||'", () => {
    const { diagnostics } = compileAndTransform(
      [
        "import { Queryable } from '@ts-linq/query';",
        '',
        'type User = { id: number };',
        '',
        'const q = new Queryable<User>();',
        'q.where(u => u.id > 1 || u.id < 0);'
      ].join('\n')
    );

    expect(diagnostics.length).toBeGreaterThan(0);
    const msg = ts.flattenDiagnosticMessageText(diagnostics[0]!.messageText, '\n');
    expect(msg).toContain("unsupported operator '||'");
  });
});

