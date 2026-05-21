// Reserved for future compile-time optimisation (P2-44 — Compiled models / AOT prep).
// The runtime path (CapturedQueryPlan + EF) handles all current test environments.
export type { EFCompileQueryVisitorVersion } from './visitors/EFCompileQueryVisitor';

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

import { type TransformContext, transformExpression } from './expression';
import { makeArray, makeObject, prop, str } from './utils';

const BRAND = '__tsLinqWhereTransformerBrand';
const TARGET_METHODS = new Set(['where', 'having', 'select']);

// ─── Scope guard ──────────────────────────────────────────────────────────────

function receiverIsQueryable(checker: ts.TypeChecker, receiver: ts.Expression): boolean {
  try {
    const type = checker.getTypeAtLocation(receiver);
    const props = checker.getPropertiesOfType(type);
    return props.some((p) => p.getName() === BRAND);
  } catch {
    return false;
  }
}

// ─── Call rewriting ───────────────────────────────────────────────────────────

/**
 * Rewrite select(e => ...) into selectCompiled({ fields: [...] }).
 * Supports:
 *   e => e.prop                              → fields: ['prop']
 *   e => ({ id: e.id, name: e.name })        → fields: ['id', 'name']
 *   e => { return { id: e.id } }             → compile error (block body)
 */
function rewriteSelectCall(
  call: ts.CallExpression,
  checker: ts.TypeChecker,
  ctx: ts.TransformationContext
): ts.CallExpression | null {
  const expr = call.expression;
  if (!ts.isPropertyAccessExpression(expr)) return null;

  const receiver = expr.expression;
  if (!receiverIsQueryable(checker, receiver)) return null;

  const arg0 = call.arguments[0];
  if (arg0 === undefined) return null;

  if (!ts.isArrowFunction(arg0)) {
    emitError(
      ctx,
      arg0,
      `select() selector must be an arrow function, not ${ts.SyntaxKind[arg0.kind]}.`
    );
    return call;
  }

  if (ts.isBlock(arg0.body)) {
    emitError(
      ctx,
      arg0.body,
      `select() selector must be a concise arrow (expression body, not a block statement).`
    );
    return call;
  }

  const firstParam = arg0.parameters[0];
  if (!firstParam || !ts.isIdentifier(firstParam.name)) {
    emitError(ctx, arg0, `select() selector must have exactly one identifier parameter.`);
    return call;
  }

  const paramName = firstParam.name.text;
  const body = arg0.body;

  // Unwrap parenthesized expression: e => ({ ... }) → ObjectLiteralExpression
  const unwrapped = ts.isParenthesizedExpression(body) ? body.expression : body;

  const fields: ts.StringLiteral[] = [];

  if (ts.isObjectLiteralExpression(unwrapped)) {
    // e => ({ id: e.id, name: e.name }) — extract accessed property names
    for (const element of unwrapped.properties) {
      if (ts.isPropertyAssignment(element) && ts.isPropertyAccessExpression(element.initializer)) {
        const access = element.initializer;
        if (ts.isIdentifier(access.expression) && access.expression.text === paramName) {
          fields.push(str(access.name.text));
          continue;
        }
      }
      // Unsupported shape — emit error and bail out
      emitError(
        ctx,
        element,
        `select() projection property must be a simple property access (e.g. { name: e.name }). ` +
          `Computed values, spreads, and method calls are not supported.`
      );
      return call;
    }
  } else if (ts.isPropertyAccessExpression(unwrapped)) {
    // e => e.prop — single field
    if (ts.isIdentifier(unwrapped.expression) && unwrapped.expression.text === paramName) {
      fields.push(str(unwrapped.name.text));
    } else {
      emitError(
        ctx,
        unwrapped,
        `select() selector must access a property of the entity parameter (e.g. e => e.name).`
      );
      return call;
    }
  } else {
    emitError(
      ctx,
      unwrapped,
      `select() selector body must be a property access or an object literal (e.g. e => e.name or e => ({ id: e.id })).`
    );
    return call;
  }

  const compiledArg = makeObject([prop('fields', makeArray(fields))]);

  const callee = ts.factory.createPropertyAccessExpression(receiver, 'selectCompiled');
  return ts.factory.createCallExpression(callee, call.typeArguments, [compiledArg]);
}

function rewriteCall(
  call: ts.CallExpression,
  checker: ts.TypeChecker,
  ctx: ts.TransformationContext
): ts.CallExpression | null {
  const expr = call.expression;
  if (!ts.isPropertyAccessExpression(expr)) return null;

  const methodName = expr.name.text;
  if (!TARGET_METHODS.has(methodName)) return null;

  // select() uses a different rewrite strategy (field extraction, not AST serialization)
  if (methodName === 'select') {
    return rewriteSelectCall(call, checker, ctx);
  }

  const receiver = expr.expression;
  if (!receiverIsQueryable(checker, receiver)) return null;

  const arg0 = call.arguments[0];
  if (arg0 === undefined) return null;

  if (!ts.isArrowFunction(arg0)) {
    emitError(
      ctx,
      arg0,
      `${methodName}() predicate must be an arrow function, not ${ts.SyntaxKind[arg0.kind]}.`
    );
    return call; // leave unchanged, build continues
  }

  if (ts.isBlock(arg0.body)) {
    emitError(
      ctx,
      arg0.body,
      `${methodName}() predicate must be a concise arrow (expression body, not a block statement).`
    );
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
    parameters
  };

  const astNode = transformExpression(arg0.body, tctx);

  // Build { ast: <node>, parameters: [<captured>, ...] }
  const compiledArg = makeObject([prop('ast', astNode), prop('parameters', makeArray(parameters))]);

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

    return ts.visitEachChild(sourceFile, visit, ctx);
  };
}

// ─── Diagnostic helper ────────────────────────────────────────────────────────

function emitError(ctx: ts.TransformationContext, node: ts.Node, message: string): void {
  const diag: ts.Diagnostic = {
    category: ts.DiagnosticCategory.Error,
    code: 90_001,
    file: node.getSourceFile(),
    start: node.getStart(),
    length: node.getWidth(),
    messageText: message
  };
  const c = ctx as unknown as { addDiagnostic?: (d: ts.Diagnostic) => void };
  if (typeof c.addDiagnostic === 'function') {
    c.addDiagnostic(diag);
  } else {
    process.stderr.write(`[ts-linq-transformer ERROR] ${message}\n`);
  }
}
