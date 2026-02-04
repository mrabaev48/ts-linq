import * as ts from 'typescript';

export const TS_LINQ_DIAGNOSTIC_CODE = 90_001;

export interface DiagnosticSink {
  readonly addDiagnostic?: (diagnostic: ts.Diagnostic) => void;
}

export function createErrorDiagnostic(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  message: string
): ts.Diagnostic {
  const start = node.getStart(sourceFile, false);
  const length = node.getWidth(sourceFile);
  return {
    category: ts.DiagnosticCategory.Error,
    code: TS_LINQ_DIAGNOSTIC_CODE,
    file: sourceFile,
    start,
    length,
    messageText: message
  };
}

export function reportDiagnostic(
  sink: DiagnosticSink | undefined,
  diagnostic: ts.Diagnostic
): void {
  sink?.addDiagnostic?.(diagnostic);
}

export function formatDiagnosticForThrow(
  tsApi: typeof ts,
  diagnostic: ts.Diagnostic
): string {
  const file = diagnostic.file;
  if (!file || diagnostic.start === undefined) {
    return tsApi.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  }
  const pos = tsApi.getLineAndCharacterOfPosition(file, diagnostic.start);
  const msg = tsApi.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  return `${file.fileName}:${String(pos.line + 1)}:${String(pos.character + 1)} - ${msg}`;
}

