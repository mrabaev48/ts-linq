import * as ts from 'typescript';

export const TS_LINQ_DIAGNOSTIC_CODE = 90_001;

export interface DiagnosticSink {
  readonly addDiagnostic: (d: ts.Diagnostic) => void;
}

export function createDiagnostic(
  node: ts.Node,
  message: string,
  category: ts.DiagnosticCategory
): ts.Diagnostic {
  return {
    category,
    code: TS_LINQ_DIAGNOSTIC_CODE,
    file: node.getSourceFile(),
    start: node.getStart(),
    length: node.getWidth(),
    messageText: message
  };
}

export function reportDiagnostic(
  sink: DiagnosticSink | undefined,
  node: ts.Node,
  message: string,
  category: ts.DiagnosticCategory = ts.DiagnosticCategory.Error
): void {
  const diag = createDiagnostic(node, message, category);
  if (sink !== undefined) {
    sink.addDiagnostic(diag);
  } else {
    const prefix = category === ts.DiagnosticCategory.Error ? 'ERROR' : 'WARN';
    process.stderr.write(`[ts-linq-transformer ${prefix}] ${message}\n`);
  }
}
