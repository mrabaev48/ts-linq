import { describe, expect, it, jest } from '@jest/globals';
import * as ts from 'typescript';

import { TS_LINQ_DIAGNOSTIC_CODE } from '../../../src/diagnostics/DiagnosticSink';
import { receiverIsEntityTypeBuilder } from '../../../src/scope/EntityTypeBuilderGuard';
import { hasTypeBrand } from '../../../src/scope/hasTypeBrand';
import { receiverIsQueryable } from '../../../src/scope/QueryableGuard';

const QUERYABLE_BRAND = '__tsLinqWhereTransformerBrand';
const BUILDER_BRAND = '__tsLinqEntityTypeBuilderBrand';

/** A real expression node so reportDiagnostic can resolve source-file/start/width. */
function makeReceiver(): ts.Expression {
  const sf = ts.createSourceFile('t.ts', 'q;', ts.ScriptTarget.ES2020, true);
  return (sf.statements[0] as ts.ExpressionStatement).expression;
}

function makeSymbol(name: string): ts.Symbol {
  return { getName: () => name } as unknown as ts.Symbol;
}

/** Checker whose getTypeAtLocation throws — simulates an incomplete type graph. */
function throwingChecker(): ts.TypeChecker {
  return {
    getTypeAtLocation: () => {
      throw new Error('checker boom');
    },
    getPropertiesOfType: () => [] as ts.Symbol[]
  } as unknown as ts.TypeChecker;
}

/** Checker that resolves a type carrying exactly the given property names. */
function checkerWithProps(...names: string[]): ts.TypeChecker {
  return {
    getTypeAtLocation: () => ({}) as ts.Type,
    getPropertiesOfType: () => names.map(makeSymbol)
  } as unknown as ts.TypeChecker;
}

describe('hasTypeBrand', () => {
  it('checker throws → returns false AND records exactly one warning diagnostic', () => {
    const diags: ts.Diagnostic[] = [];
    const sink = { addDiagnostic: (d: ts.Diagnostic) => diags.push(d) };
    const receiver = makeReceiver();

    const result = hasTypeBrand(throwingChecker(), receiver, QUERYABLE_BRAND, 'where', sink);

    expect(result).toBe(false);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.category).toBe(ts.DiagnosticCategory.Warning);
    expect(diags[0]!.code).toBe(TS_LINQ_DIAGNOSTIC_CODE);
    expect(diags[0]!.messageText as string).toContain('where');
    expect(diags[0]!.messageText as string).toContain('un-rewritten');
  });

  it('genuine non-branded receiver → false with NO diagnostic', () => {
    const diags: ts.Diagnostic[] = [];
    const sink = { addDiagnostic: (d: ts.Diagnostic) => diags.push(d) };

    const result = hasTypeBrand(
      checkerWithProps('id', 'name'),
      makeReceiver(),
      QUERYABLE_BRAND,
      'where',
      sink
    );

    expect(result).toBe(false);
    expect(diags).toHaveLength(0);
  });

  it('branded receiver → true with NO diagnostic', () => {
    const diags: ts.Diagnostic[] = [];
    const sink = { addDiagnostic: (d: ts.Diagnostic) => diags.push(d) };

    const result = hasTypeBrand(
      checkerWithProps('id', QUERYABLE_BRAND),
      makeReceiver(),
      QUERYABLE_BRAND,
      'where',
      sink
    );

    expect(result).toBe(true);
    expect(diags).toHaveLength(0);
  });

  it('tolerates an undefined sink on the throwing path (no crash, returns false)', () => {
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const result = hasTypeBrand(throwingChecker(), makeReceiver(), QUERYABLE_BRAND, 'having');
      expect(result).toBe(false);
      expect(stderrSpy).toHaveBeenCalled();
    } finally {
      stderrSpy.mockRestore();
    }
  });
});

describe('receiverIsQueryable (delegation)', () => {
  it('checker throws → false + warning carrying the method name', () => {
    const diags: ts.Diagnostic[] = [];
    const sink = { addDiagnostic: (d: ts.Diagnostic) => diags.push(d) };

    const result = receiverIsQueryable(throwingChecker(), makeReceiver(), 'select', sink);

    expect(result).toBe(false);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.messageText as string).toContain('select');
  });

  it('matches on the Queryable brand', () => {
    const result = receiverIsQueryable(checkerWithProps(QUERYABLE_BRAND), makeReceiver(), 'where');
    expect(result).toBe(true);
  });
});

describe('receiverIsEntityTypeBuilder (delegation)', () => {
  it('checker throws → false + warning carrying the method name', () => {
    const diags: ts.Diagnostic[] = [];
    const sink = { addDiagnostic: (d: ts.Diagnostic) => diags.push(d) };

    const result = receiverIsEntityTypeBuilder(
      throwingChecker(),
      makeReceiver(),
      'hasQueryFilter',
      sink
    );

    expect(result).toBe(false);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.category).toBe(ts.DiagnosticCategory.Warning);
    expect(diags[0]!.messageText as string).toContain('hasQueryFilter');
  });

  it('matches on the EntityTypeBuilder brand', () => {
    const result = receiverIsEntityTypeBuilder(
      checkerWithProps(BUILDER_BRAND),
      makeReceiver(),
      'hasQueryFilter'
    );
    expect(result).toBe(true);
  });
});
