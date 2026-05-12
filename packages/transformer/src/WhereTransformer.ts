import * as ts from 'typescript';

import { createErrorDiagnostic, formatDiagnosticForThrow, reportDiagnostic } from './diagnostics';
import { parsePredicateBodyToAst } from './ExpressionParser';
import { ensureAstImports } from './imports';
import type { AstImportName } from './types';

interface TransformerExtras extends Record<string, unknown> {
  readonly addDiagnostic?: (diagnostic: ts.Diagnostic) => void;
}

type TargetMethod = 'where' | 'having';

function isSupportedMethodName(name: string): name is TargetMethod {
  return name === 'where' || name === 'having';
}

function isTsLinqQueryDeclarationFileName(fileName: string): boolean {
  const normalized = fileName.replace(/\\/g, '/');
  return (
    normalized.includes('/packages/query/') ||
    normalized.includes('/node_modules/@ts-linq/query/') ||
    normalized.includes('/@ts-linq/query/')
  );
}

function isTsLinqQueryableMethodSignature(
  signature: ts.Signature,
  methodName: TargetMethod
): boolean {
  const decl = signature.getDeclaration();
  if (!decl) return false;
  const fileName = decl.getSourceFile().fileName;
  if (!isTsLinqQueryDeclarationFileName(fileName)) return false;

  // Ensure we match the correct method name.
  if ('name' in decl) {
    const n = (decl as unknown as { name?: ts.PropertyName }).name;
    if (n && ts.isIdentifier(n) && n.text !== methodName) return false;
  }

  // Ensure the containing class is one of our known types.
  const parent = decl.parent;
  if (!ts.isClassDeclaration(parent)) return false;
  const className = parent.name?.text;
  if (className !== 'Queryable' && className !== 'TypedQueryable') return false;
  if (methodName === 'having' && className !== 'Queryable') return false;
  return true;
}

function tryResolveTargetMethod(
  checker: ts.TypeChecker,
  call: ts.CallExpression
): { readonly methodName: TargetMethod; readonly receiver: ts.Expression } | null {
  const expr = call.expression;
  if (!ts.isPropertyAccessExpression(expr)) return null;
  const methodName = expr.name.text;
  if (!isSupportedMethodName(methodName)) return null;

  const signature = checker.getResolvedSignature(call);
  if (!signature) return null;

  if (!isTsLinqQueryableMethodSignature(signature, methodName)) return null;
  return { methodName, receiver: expr.expression };
}

function createCompiledCall(
  factory: ts.NodeFactory,
  originalCall: ts.CallExpression,
  receiver: ts.Expression,
  methodName: TargetMethod,
  astExpression: ts.Expression,
  parametersExpression: ts.ArrayLiteralExpression
): ts.CallExpression {
  const compiledMethod = `${methodName}Compiled`;
  const callee = factory.createPropertyAccessExpression(receiver, compiledMethod);
  const argObject = factory.createObjectLiteralExpression(
    [
      factory.createPropertyAssignment('ast', astExpression),
      factory.createPropertyAssignment('parameters', parametersExpression)
    ],
    true
  );
  return factory.createCallExpression(callee, originalCall.typeArguments, [argObject]);
}

function pushError(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  message: string,
  into: ts.Diagnostic[]
): void {
  into.push(createErrorDiagnostic(sourceFile, node, message));
}

function tryRewriteCall(
  checker: ts.TypeChecker,
  context: ts.TransformationContext,
  sourceFile: ts.SourceFile,
  call: ts.CallExpression,
  requiredAstImports: Set<AstImportName>,
  diagnostics: ts.Diagnostic[]
): ts.CallExpression | null {
  const resolved = tryResolveTargetMethod(checker, call);
  if (!resolved) return null;

  if (call.arguments.length !== 1) {
    pushError(
      sourceFile,
      call,
      `ts-linq(${resolved.methodName}): expected exactly one predicate argument`,
      diagnostics
    );
    return null;
  }

  const predicateArg = call.arguments[0];
  if (!predicateArg) return null;

  if (!ts.isArrowFunction(predicateArg)) {
    pushError(
      sourceFile,
      predicateArg,
      `ts-linq(${resolved.methodName}): predicate must be an arrow function`,
      diagnostics
    );
    return null;
  }

  if (predicateArg.parameters.length !== 1) {
    pushError(
      sourceFile,
      predicateArg,
      `ts-linq(${resolved.methodName}): predicate must have exactly one parameter`,
      diagnostics
    );
    return null;
  }

  const param = predicateArg.parameters[0];
  if (!param) return null;
  if (!ts.isIdentifier(param.name)) {
    pushError(
      sourceFile,
      param,
      `ts-linq(${resolved.methodName}): predicate parameter must be an identifier`,
      diagnostics
    );
    return null;
  }

  const lambdaParamSymbol = checker.getSymbolAtLocation(param.name);
  if (!lambdaParamSymbol) {
    pushError(
      sourceFile,
      param.name,
      `ts-linq(${resolved.methodName}): unable to resolve lambda parameter symbol`,
      diagnostics
    );
    return null;
  }

  if (ts.isBlock(predicateArg.body)) {
    pushError(
      sourceFile,
      predicateArg.body,
      `ts-linq(${resolved.methodName}): predicate body must be an expression (not a block)`,
      diagnostics
    );
    return null;
  }

  const parsed = parsePredicateBodyToAst(context.factory, predicateArg.body, {
    checker,
    sourceFile,
    methodName: resolved.methodName,
    lambdaParamSymbol,
    diagnostics
  });
  if (!parsed) return null;

  for (const imp of parsed.requiredAstImports) requiredAstImports.add(imp);
  return createCompiledCall(
    context.factory,
    call,
    resolved.receiver,
    resolved.methodName,
    parsed.astExpression,
    parsed.parametersExpression
  );
}

export function createWhereTransformer(
  program: ts.Program,
  extras: unknown
): ts.TransformerFactory<ts.SourceFile> {
  const checker = program.getTypeChecker();
  const extrasTyped: TransformerExtras | undefined =
    extras && typeof extras === 'object' ? (extras as TransformerExtras) : undefined;

  return (context) => (sourceFile) => {
    if (sourceFile.isDeclarationFile) return sourceFile;

    const diagnostics: ts.Diagnostic[] = [];
    const requiredAstImports = new Set<AstImportName>();
    let changed = false;

    const visit = (node: ts.Node): ts.Node => {
      if (!ts.isCallExpression(node)) return ts.visitEachChild(node, visit, context);
      const rewritten = tryRewriteCall(
        checker,
        context,
        sourceFile,
        node,
        requiredAstImports,
        diagnostics
      );
      if (!rewritten) return ts.visitEachChild(node, visit, context);
      changed = true;
      return rewritten;
    };

    const transformed = ts.visitEachChild(sourceFile, visit, context);
    const nextFile = changed
      ? ensureAstImports(transformed, context.factory, requiredAstImports)
      : transformed;

    for (const d of diagnostics) reportDiagnostic(extrasTyped, d);
    if (diagnostics.length > 0 && !extrasTyped?.addDiagnostic) {
      const first = diagnostics[0];
      if (first) throw new Error(formatDiagnosticForThrow(ts, first));
    }
    return nextFile;
  };
}
