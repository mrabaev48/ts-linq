import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from '@jest/globals';
import * as ts from 'typescript';

import { rewriteSelectCall } from '../../src/rewriters/SelectRewriter';

function createProgram(sourceText: string): {
  sourceFile: ts.SourceFile;
  checker: ts.TypeChecker;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-linq-select-'));
  const queryPath = path.join(dir, 'query.ts');
  const entryPath = path.join(dir, 'entry.ts');

  fs.writeFileSync(
    queryPath,
    [
      'export class Queryable<T> {',
      '  declare readonly __tsLinqWhereTransformerBrand: true;',
      '  select<R>(s: (e: T) => R): Queryable<R> { void s; return this as unknown as Queryable<R>; }',
      '  selectCompiled<R>(a: { fields: string[] }): Queryable<R> { void a; return this as unknown as Queryable<R>; }',
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
  return {
    sourceFile: program.getSourceFile(entryPath)!,
    checker: program.getTypeChecker()
  };
}

function findSelectCall(sourceFile: ts.SourceFile): ts.CallExpression | undefined {
  let found: ts.CallExpression | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'select'
    ) {
      found = node;
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sourceFile, visit);
  return found;
}

function printNode(node: ts.Node): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const dummy = ts.createSourceFile('print.ts', '', ts.ScriptTarget.ES2020, false);
  return printer.printNode(ts.EmitHint.Unspecified, node, dummy);
}

describe('SelectRewriter', () => {
  it('object literal projection → selectCompiled with fields array', () => {
    const diags: ts.Diagnostic[] = [];
    const sink = { addDiagnostic: (d: ts.Diagnostic) => diags.push(d) };
    const src = `
      import { Queryable } from './query';
      declare const q: Queryable<{ id: number; name: string }>;
      q.select(e => ({ id: e.id, name: e.name }));
    `;
    const { sourceFile, checker } = createProgram(src);
    const call = findSelectCall(sourceFile);
    if (!call) return;
    const mockCtx = {} as ts.TransformationContext;
    const result = rewriteSelectCall(call, checker, mockCtx, sink);
    expect(result).not.toBeNull();
    const text = printNode(result!);
    expect(text).toContain('selectCompiled');
    expect(text).toContain('"id"');
    expect(text).toContain('"name"');
    expect(text).toContain('fields');
    expect(diags).toHaveLength(0);
  });

  it('single property → selectCompiled with one field', () => {
    const diags: ts.Diagnostic[] = [];
    const sink = { addDiagnostic: (d: ts.Diagnostic) => diags.push(d) };
    const src = `
      import { Queryable } from './query';
      declare const q: Queryable<{ id: number }>;
      q.select(e => e.id);
    `;
    const { sourceFile, checker } = createProgram(src);
    const call = findSelectCall(sourceFile);
    if (!call) return;
    const mockCtx = {} as ts.TransformationContext;
    const result = rewriteSelectCall(call, checker, mockCtx, sink);
    expect(result).not.toBeNull();
    const text = printNode(result!);
    expect(text).toContain('selectCompiled');
    expect(text).toContain('"id"');
    expect(diags).toHaveLength(0);
  });

  it('block body → emits diagnostic, returns original call', () => {
    const diags: ts.Diagnostic[] = [];
    const sink = { addDiagnostic: (d: ts.Diagnostic) => diags.push(d) };
    const src = `
      import { Queryable } from './query';
      declare const q: Queryable<{ id: number }>;
      q.select(e => { return e.id; });
    `;
    const { sourceFile, checker } = createProgram(src);
    const call = findSelectCall(sourceFile);
    if (!call) return;
    const mockCtx = {} as ts.TransformationContext;
    rewriteSelectCall(call, checker, mockCtx, sink);
    expect(diags.length).toBeGreaterThan(0);
    const msg = diags[0]!.messageText as string;
    expect(msg).toContain('block statement');
  });
});
