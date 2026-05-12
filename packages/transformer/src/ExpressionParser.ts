import * as ts from 'typescript';

import { createErrorDiagnostic } from './diagnostics';
import type { AstImportName } from './types';

export interface ParsedPredicate {
  readonly astExpression: ts.Expression;
  readonly parametersExpression: ts.ArrayLiteralExpression;
  readonly requiredAstImports: ReadonlySet<AstImportName>;
}

export interface PredicateParseContext {
  readonly checker: ts.TypeChecker;
  readonly sourceFile: ts.SourceFile;
  readonly methodName: 'where' | 'having';
  readonly lambdaParamSymbol: ts.Symbol;
  readonly diagnostics: ts.Diagnostic[];
}

function enumAccess(
  factory: ts.NodeFactory,
  enumName: AstImportName,
  memberName: string
): ts.PropertyAccessExpression {
  return factory.createPropertyAccessExpression(factory.createIdentifier(enumName), memberName);
}

function pushError(ctx: PredicateParseContext, node: ts.Node, message: string): void {
  ctx.diagnostics.push(createErrorDiagnostic(ctx.sourceFile, node, message));
}

function unwrapParens(expr: ts.Expression): ts.Expression {
  let cur: ts.Expression = expr;
  while (ts.isParenthesizedExpression(cur)) cur = cur.expression;
  return cur;
}

function referencesLambdaParam(
  expr: ts.Expression,
  checker: ts.TypeChecker,
  lambdaParamSymbol: ts.Symbol
): boolean {
  let found = false;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (ts.isIdentifier(n)) {
      const sym = checker.getSymbolAtLocation(n);
      if (sym && sym === lambdaParamSymbol) {
        found = true;
        return;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(expr);
  return found;
}

function containsDisallowedNodes(expr: ts.Expression): ts.Node | null {
  let bad: ts.Node | null = null;
  const visit = (n: ts.Node): void => {
    if (bad) return;
    if (ts.isCallExpression(n)) {
      bad = n;
      return;
    }
    if (ts.isNewExpression(n)) {
      bad = n;
      return;
    }
    if (ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      bad = n;
      return;
    }
    if (ts.isConditionalExpression(n)) {
      bad = n;
      return;
    }
    if (ts.isAwaitExpression(n) || ts.isYieldExpression(n)) {
      bad = n;
      return;
    }
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind;
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
        bad = n.operatorToken;
        return;
      }
      if (
        op === ts.SyntaxKind.EqualsToken ||
        op === ts.SyntaxKind.PlusEqualsToken ||
        op === ts.SyntaxKind.MinusEqualsToken ||
        op === ts.SyntaxKind.AsteriskEqualsToken ||
        op === ts.SyntaxKind.SlashEqualsToken ||
        op === ts.SyntaxKind.PercentEqualsToken ||
        op === ts.SyntaxKind.AmpersandEqualsToken ||
        op === ts.SyntaxKind.BarEqualsToken ||
        op === ts.SyntaxKind.CaretEqualsToken ||
        op === ts.SyntaxKind.LessThanLessThanEqualsToken ||
        op === ts.SyntaxKind.GreaterThanGreaterThanEqualsToken ||
        op === ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken
      ) {
        bad = n.operatorToken;
        return;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(expr);
  return bad;
}

function tryParseLiteralExpression(factory: ts.NodeFactory, expr: ts.Expression): ts.Expression | null {
  const e = unwrapParens(expr);
  if (ts.isNumericLiteral(e)) return factory.createNumericLiteral(e.text);
  if (ts.isStringLiteral(e)) return factory.createStringLiteral(e.text);
  if (e.kind === ts.SyntaxKind.TrueKeyword) return factory.createTrue();
  if (e.kind === ts.SyntaxKind.FalseKeyword) return factory.createFalse();
  if (e.kind === ts.SyntaxKind.NullKeyword) return factory.createNull();
  if (ts.isPrefixUnaryExpression(e)) {
    if (e.operator === ts.SyntaxKind.MinusToken || e.operator === ts.SyntaxKind.PlusToken) {
      const operand = unwrapParens(e.operand);
      if (ts.isNumericLiteral(operand)) {
        return factory.createPrefixUnaryExpression(
          e.operator,
          factory.createNumericLiteral(operand.text)
        );
      }
    }
  }
  return null;
}

function createMemberAccessNode(factory: ts.NodeFactory, path: readonly string[]): ts.ObjectLiteralExpression {
  return factory.createObjectLiteralExpression(
    [
      factory.createPropertyAssignment('type', factory.createStringLiteral('MemberAccess')),
      factory.createPropertyAssignment(
        'path',
        factory.createArrayLiteralExpression(path.map((p) => factory.createStringLiteral(p)), false)
      )
    ],
    false
  );
}

function createLiteralNode(factory: ts.NodeFactory, valueExpression: ts.Expression): ts.ObjectLiteralExpression {
  return factory.createObjectLiteralExpression(
    [
      factory.createPropertyAssignment('type', factory.createStringLiteral('Literal')),
      factory.createPropertyAssignment('value', valueExpression)
    ],
    false
  );
}

function createParameterRefNode(factory: ts.NodeFactory, index: number): ts.ObjectLiteralExpression {
  return factory.createObjectLiteralExpression(
    [
      factory.createPropertyAssignment('type', factory.createStringLiteral('ParameterRef')),
      factory.createPropertyAssignment('index', factory.createNumericLiteral(index))
    ],
    false
  );
}

function createBinaryExpressionNode(
  factory: ts.NodeFactory,
  operatorExpr: ts.Expression,
  left: ts.ObjectLiteralExpression,
  right: ts.ObjectLiteralExpression
): ts.ObjectLiteralExpression {
  return factory.createObjectLiteralExpression(
    [
      factory.createPropertyAssignment('type', factory.createStringLiteral('BinaryExpression')),
      factory.createPropertyAssignment('left', left),
      factory.createPropertyAssignment('operator', operatorExpr),
      factory.createPropertyAssignment('right', right)
    ],
    false
  );
}

function createLogicalExpressionNode(
  factory: ts.NodeFactory,
  operatorExpr: ts.Expression,
  expressions: readonly ts.Expression[]
): ts.ObjectLiteralExpression {
  return factory.createObjectLiteralExpression(
    [
      factory.createPropertyAssignment('type', factory.createStringLiteral('LogicalExpression')),
      factory.createPropertyAssignment('operator', operatorExpr),
      factory.createPropertyAssignment('expressions', factory.createArrayLiteralExpression(expressions, false))
    ],
    false
  );
}

function createUnaryExpressionNode(
  factory: ts.NodeFactory,
  operatorExpr: ts.Expression,
  operand: ts.Expression
): ts.ObjectLiteralExpression {
  return factory.createObjectLiteralExpression(
    [
      factory.createPropertyAssignment('type', factory.createStringLiteral('UnaryExpression')),
      factory.createPropertyAssignment('operator', operatorExpr),
      factory.createPropertyAssignment('operand', operand)
    ],
    false
  );
}

function parseMemberAccessPath(
  expr: ts.Expression,
  ctx: PredicateParseContext
): readonly string[] | null {
  const e = unwrapParens(expr);
  const parts: string[] = [];
  let cur: ts.Expression = e;
  while (ts.isPropertyAccessExpression(cur)) {
    parts.push(cur.name.text);
    cur = unwrapParens(cur.expression);
  }
  if (!ts.isIdentifier(cur)) {
    pushError(
      ctx,
      expr,
      `ts-linq(${ctx.methodName}): left operand must be a member access rooted at the lambda parameter`
    );
    return null;
  }
  const sym = ctx.checker.getSymbolAtLocation(cur);
  if (!sym || sym !== ctx.lambdaParamSymbol) {
    pushError(
      ctx,
      expr,
      `ts-linq(${ctx.methodName}): left operand must be a member access rooted at the lambda parameter`
    );
    return null;
  }
  return parts.reverse();
}

function parseExpression(
  factory: ts.NodeFactory,
  expr: ts.Expression,
  ctx: PredicateParseContext,
  requiredImports: Set<AstImportName>,
  capturedParameters: ts.Expression[]
): ts.Expression | null {
  const e = unwrapParens(expr);

  const literalExpr = tryParseLiteralExpression(factory, e);
  if (literalExpr) {
    return createLiteralNode(factory, literalExpr);
  }

  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.ExclamationToken) {
    requiredImports.add('UnaryOperator');
    const operandExpression = unwrapParens(e.operand);
    const operand = (() => {
      if (ts.isPropertyAccessExpression(operandExpression)) {
        const memberPath = parseMemberAccessPath(operandExpression, ctx);
        if (!memberPath) return null;
        return createMemberAccessNode(factory, memberPath);
      }
      return parseExpression(factory, operandExpression, ctx, requiredImports, capturedParameters);
    })();
    if (!operand) return null;
    // Disallow NOT over a literal, to match runtime SqlVisitor validation.
    if (ts.isObjectLiteralExpression(operand)) {
      const typeProp = operand.properties.find(
        (p): p is ts.PropertyAssignment =>
          ts.isPropertyAssignment(p) &&
          ts.isIdentifier(p.name) &&
          p.name.text === 'type'
      );
      if (
        typeProp &&
        ts.isStringLiteral(typeProp.initializer) &&
        typeProp.initializer.text === 'Literal'
      ) {
        pushError(
          ctx,
          e,
          `ts-linq(${ctx.methodName}): unary '!' is only supported for MemberAccess or boolean expressions`
        );
        return null;
      }
    }
    return createUnaryExpressionNode(factory, enumAccess(factory, 'UnaryOperator', 'Not'), operand);
  }

  if (ts.isBinaryExpression(e)) {
    const op = e.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
      requiredImports.add('LogicalOperator');
      const flattened: ts.Expression[] = [];
      let hasError = false;
      const collect = (n: ts.Expression): void => {
        const inner = unwrapParens(n);
        if (ts.isBinaryExpression(inner) && inner.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
          collect(inner.left);
          collect(inner.right);
          return;
        }
        const parsed = parseExpression(factory, inner, ctx, requiredImports, capturedParameters);
        if (!parsed) {
          hasError = true;
          return;
        }
        flattened.push(parsed);
      };
      collect(e);
      if (hasError || flattened.length === 0) {
        pushError(ctx, e, `ts-linq(${ctx.methodName}): unsupported expression`);
        return null;
      }
      return createLogicalExpressionNode(factory, enumAccess(factory, 'LogicalOperator', 'And'), flattened);
    }

    if (op === ts.SyntaxKind.BarBarToken) {
      pushError(ctx, e.operatorToken, `ts-linq(${ctx.methodName}): unsupported operator '||'`);
      return null;
    }
    if (op === ts.SyntaxKind.QuestionQuestionToken) {
      pushError(ctx, e.operatorToken, `ts-linq(${ctx.methodName}): unsupported operator '??'`);
      return null;
    }

    const memberPath = parseMemberAccessPath(e.left, ctx);
    if (!memberPath) return null;
    const leftNode = createMemberAccessNode(factory, memberPath);

    const comparisonOp = (() => {
      switch (op) {
        case ts.SyntaxKind.EqualsEqualsEqualsToken:
        case ts.SyntaxKind.EqualsEqualsToken:
          requiredImports.add('ComparisonOperator');
          return enumAccess(factory, 'ComparisonOperator', 'Eq');
        case ts.SyntaxKind.GreaterThanToken:
          requiredImports.add('ComparisonOperator');
          return enumAccess(factory, 'ComparisonOperator', 'Gt');
        case ts.SyntaxKind.GreaterThanEqualsToken:
          requiredImports.add('ComparisonOperator');
          return enumAccess(factory, 'ComparisonOperator', 'Gte');
        case ts.SyntaxKind.LessThanToken:
          requiredImports.add('ComparisonOperator');
          return enumAccess(factory, 'ComparisonOperator', 'Lt');
        case ts.SyntaxKind.LessThanEqualsToken:
          requiredImports.add('ComparisonOperator');
          return enumAccess(factory, 'ComparisonOperator', 'Lte');
        default:
          return null;
      }
    })();

    if (!comparisonOp) {
      pushError(
        ctx,
        e.operatorToken,
        `ts-linq(${ctx.methodName}): unsupported operator '${e.operatorToken.getText(ctx.sourceFile)}'`
      );
      return null;
    }

    // RHS can be a literal OR a closure value (no lambda param refs).
    const rhsLiteral = tryParseLiteralExpression(factory, e.right);
    if (rhsLiteral) {
      const rightNode = createLiteralNode(factory, rhsLiteral);
      return createBinaryExpressionNode(factory, comparisonOp, leftNode, rightNode);
    }

    if (referencesLambdaParam(e.right, ctx.checker, ctx.lambdaParamSymbol)) {
      pushError(
        ctx,
        e.right,
        `ts-linq(${ctx.methodName}): right operand must be a literal or a closure value`
      );
      return null;
    }

    const bad = containsDisallowedNodes(e.right);
    if (bad) {
      const badText = bad.getText(ctx.sourceFile);
      if (badText === '||') {
        pushError(ctx, bad, `ts-linq(${ctx.methodName}): unsupported operator '||'`);
      } else if (badText === '??') {
        pushError(ctx, bad, `ts-linq(${ctx.methodName}): unsupported operator '??'`);
      } else {
        pushError(ctx, bad, `ts-linq(${ctx.methodName}): unsupported expression`);
      }
      return null;
    }

    const idx = capturedParameters.length;
    capturedParameters.push(e.right);
    const rightNode = createParameterRefNode(factory, idx);
    return createBinaryExpressionNode(factory, comparisonOp, leftNode, rightNode);
  }

  pushError(ctx, e, `ts-linq(${ctx.methodName}): unsupported expression`);
  return null;
}

export function parsePredicateBodyToAst(
  factory: ts.NodeFactory,
  body: ts.Expression,
  ctx: PredicateParseContext
): ParsedPredicate | null {
  const requiredImports = new Set<AstImportName>();
  const capturedParameters: ts.Expression[] = [];

  // `SqlVisitor` does not accept `Literal` (or other non-boolean) roots, so reject early.
  if (tryParseLiteralExpression(factory, body)) {
    pushError(ctx, body, `ts-linq(${ctx.methodName}): unsupported expression`);
    return null;
  }

  const astExpression = parseExpression(factory, body, ctx, requiredImports, capturedParameters);
  if (!astExpression) return null;

  const parametersExpression = factory.createArrayLiteralExpression(capturedParameters, false);
  return { astExpression, parametersExpression, requiredAstImports: requiredImports };
}

