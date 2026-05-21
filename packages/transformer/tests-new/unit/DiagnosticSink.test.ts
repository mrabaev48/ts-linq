import { describe, expect, it, jest } from '@jest/globals';
import * as ts from 'typescript';

import {
  createDiagnostic,
  extractSinkFromCtx,
  reportDiagnostic,
  TS_LINQ_DIAGNOSTIC_CODE
} from '../../src/diagnostics/DiagnosticSink';

function makeNode(): ts.Node {
  const sf = ts.createSourceFile('test.ts', 'x', ts.ScriptTarget.ES2020, true);
  return sf.statements[0]!;
}

describe('createDiagnostic', () => {
  it('creates a diagnostic with the correct code and category', () => {
    const node = makeNode();
    const diag = createDiagnostic(node, 'test message', ts.DiagnosticCategory.Error);
    expect(diag.code).toBe(TS_LINQ_DIAGNOSTIC_CODE);
    expect(diag.category).toBe(ts.DiagnosticCategory.Error);
    expect(diag.messageText).toBe('test message');
    expect(diag.file).toBe(node.getSourceFile());
  });

  it('creates warning diagnostic', () => {
    const node = makeNode();
    const diag = createDiagnostic(node, 'warn msg', ts.DiagnosticCategory.Warning);
    expect(diag.category).toBe(ts.DiagnosticCategory.Warning);
  });
});

describe('reportDiagnostic', () => {
  it('calls sink.addDiagnostic when sink is present', () => {
    const node = makeNode();
    const addDiagnostic = jest.fn();
    reportDiagnostic({ addDiagnostic }, node, 'hello');
    expect(addDiagnostic).toHaveBeenCalledTimes(1);
    const [diag] = addDiagnostic.mock.calls[0] as [ts.Diagnostic];
    expect(diag.messageText).toBe('hello');
    expect(diag.code).toBe(TS_LINQ_DIAGNOSTIC_CODE);
  });

  it('writes to stderr when sink is undefined', () => {
    const node = makeNode();
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    reportDiagnostic(undefined, node, 'fallback error');
    expect(stderrSpy).toHaveBeenCalled();
    const written = stderrSpy.mock.calls[0]?.[0] as string;
    expect(written).toContain('fallback error');
    stderrSpy.mockRestore();
  });

  it('defaults to Error category', () => {
    const node = makeNode();
    const addDiagnostic = jest.fn();
    reportDiagnostic({ addDiagnostic }, node, 'err');
    const [diag] = addDiagnostic.mock.calls[0] as [ts.Diagnostic];
    expect(diag.category).toBe(ts.DiagnosticCategory.Error);
  });
});

describe('extractSinkFromCtx', () => {
  it('returns undefined for a plain TransformationContext', () => {
    const ctx = {} as ts.TransformationContext;
    expect(extractSinkFromCtx(ctx)).toBeUndefined();
  });

  it('extracts a DiagnosticSink from an augmented context', () => {
    const calls: ts.Diagnostic[] = [];
    const augmented = {
      addDiagnostic: (d: ts.Diagnostic) => {
        calls.push(d);
      }
    } as unknown as ts.TransformationContext;

    const sink = extractSinkFromCtx(augmented);
    expect(sink).toBeDefined();

    const node = makeNode();
    const diag = createDiagnostic(node, 'test', ts.DiagnosticCategory.Error);
    sink!.addDiagnostic(diag);
    expect(calls).toHaveLength(1);
  });
});
