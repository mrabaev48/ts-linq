/**
 * ts-patch entrypoint for the ts-linq compile-time transformer.
 *
 * Rewrites `.where(u => ...)` and `.having(u => ...)` calls on `@ts-linq/query`
 * Queryable/TypedQueryable instances into `.whereCompiled({ ast, parameters })`
 * and `.havingCompiled({ ast, parameters })` calls, where `ast` is a serialized
 * ExpressionNode object literal built at compile time.
 *
 * Scope detection uses a type-brand property (`__tsLinqWhereTransformerBrand`)
 * on Queryable/TypedQueryable — more reliable than file-path heuristics.
 */

import * as ts from 'typescript';
import { transformExpression, type TransformContext } from './expression';
import { makeObject, makeArray, prop, str, num } from './utils';

const BRAND = '__tsLinqWhereTransformerBrand';
const TARGET_METHODS = new Set(['where', 'having']);

// ─── Scope guard ──────────────────────────────────────────────────────────────

function receiverIsQueryable(
  checker: ts.TypeChecker,
  receiver: ts.Expression
): boolean {
  try {
    const type = checker.getTypeAtLocation(receiver);
    const props = checker.getPropertiesOfType(type);
    return props.some(p => p.getName() === BRAND);
  } catch {
    return false;
  }
}

// ─── Call rewriting ───────────────────────────────────────────────────────────

function rewriteCall(
  call: ts.CallExpression,
  checker: ts.TypeChecker,
  ctx: ts.TransformationContext
): ts.CallExpression | null {
  const expr = call.expression;
  if (!ts.isPropertyAccessExpression(expr)) return null;

  const methodName = expr.name.text;
  if (!TARGET_METHODS.has(methodName)) return null;

  const receiver = expr.expression;
  if (!receiverIsQueryable(checker, receiver)) return null;

  const arg0 = call.arguments[0];
  if (arg0 === undefined) return null;

  if (!ts.isArrowFunction(arg0)) {
    emitError(ctx, arg0, `${methodName}() predicate must be an arrow function, not ${ts.SyntaxKind[arg0.kind]}.`);
    return call; // leave unchanged, build continues
  }

  if (ts.isBlock(arg0.body)) {
    emitError(ctx, arg0.body, `${methodName}() predicate must be a concise arrow (expression body, not a block statement).`);
    return call;
  }

  const firstParam = arg0.parameters[0];
  if (!firstParam || !ts.isIdentifier(firstParam.name)) {
    emitError(ctx, arg0, `${methodName}() predicate must have exactly one identifier parameter.`);
    return call;
  }

  const paramName = firstParam.name.text;
  const parameters: ts.Expression[] = [];

  const tctx: TransformContext = {
    ctx,
    methodName,
    paramName,
    parameters,
  };

  const astNode = transformExpression(arg0.body, tctx);

  // Build { ast: <node>, parameters: [<captured>, ...] }
  const compiledArg = makeObject([
    prop('ast', astNode),
    prop('parameters', makeArray(parameters)),
  ]);

  const compiledMethod = `${methodName}Compiled`;
  const callee = ts.factory.createPropertyAccessExpression(receiver, compiledMethod);
  return ts.factory.createCallExpression(callee, call.typeArguments, [compiledArg]);
}

// ─── Transformer factory ──────────────────────────────────────────────────────

export default function tsLinqTransformer(
  program: ts.Program,
  _pluginConfig: unknown,
  _extras?: unknown
): ts.TransformerFactory<ts.SourceFile> {
  const checker = program.getTypeChecker();

  return (ctx) => (sourceFile) => {
    if (sourceFile.isDeclarationFile) return sourceFile;

    const visit = (node: ts.Node): ts.Node => {
      if (ts.isCallExpression(node)) {
        const rewritten = rewriteCall(node, checker, ctx);
        if (rewritten !== null && rewritten !== node) return rewritten;
      }
      return ts.visitEachChild(node, visit, ctx);
    };

    return ts.visitEachChild(sourceFile, visit, ctx) as ts.SourceFile;
  };
}

// ─── Diagnostic helper ────────────────────────────────────────────────────────

function emitError(
  ctx: ts.TransformationContext,
  node: ts.Node,
  message: string
): void {
  const diag: ts.Diagnostic = {
    category: ts.DiagnosticCategory.Error,
    code: 90_001,
    file: node.getSourceFile(),
    start: node.getStart(),
    length: node.getWidth(),
    messageText: message,
  };
  const c = ctx as unknown as { addDiagnostic?: (d: ts.Diagnostic) => void };
  if (typeof c.addDiagnostic === 'function') {
    c.addDiagnostic(diag);
  } else {
    process.stderr.write(`[ts-linq-transformer ERROR] ${message}\n`);
  }
}
