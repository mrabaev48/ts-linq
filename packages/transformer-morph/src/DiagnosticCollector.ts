import * as ts from 'typescript';

import type { DiagnosticSink } from './core';

/**
 * In-memory {@link DiagnosticSink} used by every transformer-morph pipeline.
 *
 * The legacy ts-patch entrypoint of `@ts-linq/transformer` reads its sink from the
 * augmented TransformationContext; here the host always owns the sink explicitly.
 * Collected diagnostics keep their original `ts.Diagnostic` shape (file, span,
 * TS_LINQ_DIAGNOSTIC_CODE) and can be formatted alongside regular compiler output.
 */
export class DiagnosticCollector implements DiagnosticSink {
  private readonly collected: ts.Diagnostic[] = [];

  public readonly addDiagnostic = (diagnostic: ts.Diagnostic): void => {
    this.collected.push(diagnostic);
  };

  public get diagnostics(): readonly ts.Diagnostic[] {
    return this.collected;
  }

  public get errorCount(): number {
    return this.collected.filter((d) => d.category === ts.DiagnosticCategory.Error).length;
  }

  public get hasErrors(): boolean {
    return this.errorCount > 0;
  }
}

/** Formatting host shared by {@link formatDiagnostics} and the CLI. */
const FORMAT_HOST: ts.FormatDiagnosticsHost = {
  getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
  getCanonicalFileName: (fileName) =>
    ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
  getNewLine: () => ts.sys.newLine
};

/**
 * Renders diagnostics with the standard TypeScript formatter.
 *
 * @param pretty `true` → colourised output with code frames (same as `tsc --pretty`).
 */
export function formatDiagnostics(
  diagnostics: readonly ts.Diagnostic[],
  pretty: boolean = true
): string {
  if (diagnostics.length === 0) return '';
  return pretty
    ? ts.formatDiagnosticsWithColorAndContext(diagnostics, FORMAT_HOST)
    : ts.formatDiagnostics(diagnostics, FORMAT_HOST);
}
