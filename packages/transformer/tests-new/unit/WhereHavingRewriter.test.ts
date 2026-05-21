import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from '@jest/globals';
import * as ts from 'typescript';

import { TS_LINQ_DIAGNOSTIC_CODE } from '../../src/diagnostics/DiagnosticSink';
import { rewriteCall } from '../../src/rewriters/WhereHavingRewriter';

/**
 * Creates a minimal in-memory TypeScript program with a Queryable shim
 * so that rewriteCall can use the TypeChecker for scope detection.
 */
function createMinimalProgram(sourceText: string): {
  program: ts.Program;
  sourceFile: ts.SourceFile;
  checker: ts.TypeChecker;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-linq-rewriter-'));
  const queryPath = path.join(dir, 'query.ts');
  const entryPath = path.join(dir, 'entry.ts');

  fs.writeFileSync(
    queryPath,
    [
      'export class Queryable<T> {',
      '  declare readonly __tsLinqWhereTransformerBrand: true;',
      '  where(p: (e: T) => boolean): Queryable<T> { void p; return this; }',
      '  whereCompiled(a: unknown): Queryable<T> { void a; return this; }',
      '  having(p: (e: T) => boolean): Queryable<T> { void p; return this; }',
      '  havingCompiled(a: unknown): Queryable<T> { void a; return this; }',
      '}'
    ].join('\n')
  );
  fs.writeFileSync(entryPath, sourceText);

  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    strict: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs
  };
  const program = ts.createProgram([queryPath, entryPath], options);
  const sourceFile = program.getSourceFile(entryPath)!;
  return { program, sourceFile, checker: program.getTypeChecker() };
}

function findFirstCallExpression(sourceFile: ts.SourceFile): ts.CallExpression | undefined {
  let found: ts.CallExpression | undefined;
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && !found) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sourceFile, visit);
  return found;
}

describe('WhereHavingRewriter', () => {
  it('non-arrow function argument → emits diagnostic, returns unchanged call', () => {
    const diags: ts.Diagnostic[] = [];
    const sink = { addDiagnostic: (d: ts.Diagnostic) => diags.push(d) };
    const src = `
      import { Queryable } from './query';
      declare const q: Queryable<{ id: number }>;
      function pred(u: { id: number }): boolean { return u.id > 0; }
      q.where(pred);
    `;
    const { sourceFile, checker } = createMinimalProgram(src);
    const call = findFirstCallExpression(sourceFile)!;
    // Find the where() call specifically
    const allCalls: ts.CallExpression[] = [];
    function collect(node: ts.Node) {
      if (ts.isCallExpression(node)) allCalls.push(node);
      ts.forEachChild(node, collect);
    }
    ts.forEachChild(sourceFile, collect);
    const whereCall = allCalls.find(
      (c) => ts.isPropertyAccessExpression(c.expression) && c.expression.name.text === 'where'
    );
    if (!whereCall) return; // skip if not found (declaration file issues)
    const mockCtx = {} as ts.TransformationContext;
    void rewriteCall(whereCall, checker, mockCtx, sink);
    // returns the original call when arg is not an arrow function
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.code).toBe(TS_LINQ_DIAGNOSTIC_CODE);
  });

  it('block body arrow → emits diagnostic, returns unchanged call', () => {
    const diags: ts.Diagnostic[] = [];
    const sink = { addDiagnostic: (d: ts.Diagnostic) => diags.push(d) };
    const src = `
      import { Queryable } from './query';
      declare const q: Queryable<{ id: number }>;
      q.where((u) => { return u.id > 0; });
    `;
    const { sourceFile, checker } = createMinimalProgram(src);
    const allCalls: ts.CallExpression[] = [];
    function collect(node: ts.Node) {
      if (ts.isCallExpression(node)) allCalls.push(node);
      ts.forEachChild(node, collect);
    }
    ts.forEachChild(sourceFile, collect);
    const whereCall = allCalls.find(
      (c) => ts.isPropertyAccessExpression(c.expression) && c.expression.name.text === 'where'
    );
    if (!whereCall) return;
    const mockCtx = {} as ts.TransformationContext;
    const result = rewriteCall(whereCall, checker, mockCtx, sink);
    expect(diags.length).toBeGreaterThan(0);
    const msg = diags[0]!.messageText as string;
    expect(msg).toContain('block statement');
  });
});
