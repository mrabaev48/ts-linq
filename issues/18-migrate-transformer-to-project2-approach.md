# Issue #18 — Миграция Трансформера на Подход из project2

**Severity:** High (техническое улучшение с breaking changes)  
**Category:** Transformer / DX / Type Safety  
**Affected files:**
- `packages/transformer/src/index.ts`
- `packages/transformer/src/WhereTransformer.ts`
- `packages/transformer/src/ExpressionParser.ts`
- `packages/transformer/src/AstHelpers.ts`
- `packages/transformer/src/NodeFactory.ts`
- `packages/transformer/src/TypeExtractor.ts`
- `packages/core/src/query/Queryable.ts` (добавление type brand)
- `packages/core/src/query/TypedQueryable.ts` (добавление type brand)

---

## Мотивация

Текущий трансформер имеет четыре критических ограничения:

| Проблема | Текущий трансформер | project2 подход |
|---|---|---|
| **Scope guard** | Проверка пути файла (`includes('ts-linq')`) — ломается при переименовании | Type brand через TypeChecker — надёжно, рефактор-safe |
| **Поддерживаемые выражения** | `&&`, `===`, `>`, `<`, `>=`, `<=`, `!=` | + `\|\|`, `!`, `IS NULL`, `IN`, `.includes()`, `.startsWith()`, `.endsWith()`, optional chaining, nested paths, nullish coalescing |
| **Обработка ошибок** | Бросает на первой ошибке → нет fallback, пользователь видит одну ошибку за раз | Sentinel + сбор всех ошибок → компилятор показывает все проблемы сразу |
| **Архитектура** | 6 файлов с размытыми ответственностями | 3 файла: `index.ts`, `expression.ts`, `utils.ts` |

---

## Обзор целевой архитектуры

```
packages/transformer/src/
├── index.ts          ← точка входа, scope guard через type brand, трансформация вызовов
├── expression.ts     ← рекурсивный AST → ExpressionNode конвертер
└── utils.ts          ← чистые хелперы: AST factories, emitDiagnostic, makeUnsupported, collectPropertyChain
```

Против текущих 6 файлов: `index.ts`, `WhereTransformer.ts`, `ExpressionParser.ts`, `AstHelpers.ts`, `NodeFactory.ts`, `TypeExtractor.ts`.

---

## Шаг 0: Подготовка — Добавить Type Brand в Queryable

### Что нужно сделать

Добавить уникальный символьный тип-бренд в `Queryable<T>` и `TypedQueryable<T>`:

```ts
// packages/core/src/query/Queryable.ts
export class Queryable<T> {
  // Используется только compile-time трансформером для идентификации типа
  declare readonly __tsLinqWhereTransformerBrand: unique symbol;
  
  // ... остальной код
}
```

```ts
// packages/core/src/query/TypedQueryable.ts (если существует)
export class TypedQueryable<T> extends Queryable<T> {
  declare readonly __tsLinqWhereTransformerBrand: unique symbol;
}
```

Ключевые детали:
- `declare` — поле существует только в типах, не генерирует runtime код
- `unique symbol` — каждый `declare` создаёт уникальный тип, нельзя подделать снаружи
- Не `private` — трансформер читает через `TypeChecker.getPropertiesOfType()` и видит только публичные свойства

### Почему именно так

TypeChecker работает с системой типов TypeScript. Когда трансформер видит вызов `.where(...)`, он получает тип объекта через `checker.getTypeAtLocation(callExpr.expression)`. Затем проверяет наличие `__tsLinqWhereTransformerBrand` в свойствах этого типа. Это надёжно — бренд не может появиться случайно, не зависит от пути файла, работает с любым алиасом или re-export.

---

## Шаг 1: Создать `utils.ts` — Чистые Хелперы

```ts
// packages/transformer/src/utils.ts
import ts from 'typescript';

// --- AST Factories ---

export function str(factory: ts.NodeFactory, value: string): ts.StringLiteral {
  return factory.createStringLiteral(value);
}

export function num(factory: ts.NodeFactory, value: number): ts.NumericLiteral {
  return factory.createNumericLiteral(value);
}

export function prop(
  factory: ts.NodeFactory,
  obj: ts.Expression,
  key: string
): ts.PropertyAccessExpression {
  return factory.createPropertyAccessExpression(obj, key);
}

export function makeObject(
  factory: ts.NodeFactory,
  entries: Record<string, ts.Expression>
): ts.ObjectLiteralExpression {
  return factory.createObjectLiteralExpression(
    Object.entries(entries).map(([k, v]) =>
      factory.createPropertyAssignment(k, v)
    ),
    true
  );
}

export function makeArray(
  factory: ts.NodeFactory,
  elements: ts.Expression[]
): ts.ArrayLiteralExpression {
  return factory.createArrayLiteralExpression(elements, false);
}

// --- Диагностика ---

export function emitDiagnostic(
  program: ts.Program,
  node: ts.Node,
  message: string,
  category: ts.DiagnosticCategory = ts.DiagnosticCategory.Error
): void {
  const sourceFile = node.getSourceFile();
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  
  // Используем internal API для добавления диагностики в программу
  const diagnostics = (program as unknown as { 
    _diagnosticsProducingTypeChecker?: { getDiagnostics?: () => ts.Diagnostic[] }
  });
  
  // Fallback: выводим в stderr — TypeScript подберёт при следующем запуске
  process.stderr.write(
    `[ts-linq transformer] ${sourceFile.fileName}:${line + 1}:${character + 1} - ${ts.DiagnosticCategory[category]}: ${message}\n`
  );
}

// --- Sentinel для неподдерживаемых выражений ---

export interface UnsupportedNode {
  type: 'unsupported';
  syntaxKind: number;
  syntaxKindName: string;
  description: string;
}

export function makeUnsupported(
  factory: ts.NodeFactory,
  node: ts.Node,
  description: string,
  program: ts.Program
): ts.ObjectLiteralExpression {
  emitDiagnostic(
    program,
    node,
    `Unsupported expression in where(): ${description}. Rewrite using supported operators.`,
    ts.DiagnosticCategory.Error
  );
  
  return makeObject(factory, {
    type: str(factory, 'unsupported'),
    syntaxKind: num(factory, node.kind),
    syntaxKindName: str(factory, syntaxKindName(node.kind)),
    description: str(factory, description),
  });
}

export function syntaxKindName(kind: ts.SyntaxKind): string {
  return ts.SyntaxKind[kind] ?? `Unknown(${kind})`;
}

// --- Property Chain Collector ---

export interface PropertyChain {
  root: string;          // имя параметра (e.g. 'u')
  segments: string[];    // путь (e.g. ['profile', 'name'])
  hasOptional: boolean;  // true если есть ?. в цепочке
}

export function collectPropertyChain(
  node: ts.Expression
): PropertyChain | null {
  const segments: string[] = [];
  let hasOptional = false;
  let current: ts.Expression = node;

  while (
    ts.isPropertyAccessExpression(current) ||
    ts.isElementAccessExpression(current)
  ) {
    if (ts.isPropertyAccessExpression(current)) {
      if (current.questionDotToken) hasOptional = true;
      segments.unshift(current.name.text);
      current = current.expression;
    } else {
      // ElementAccessExpression (u['field']) — не поддерживаем
      return null;
    }
  }

  if (!ts.isIdentifier(current)) return null;

  return {
    root: current.text,
    segments,
    hasOptional,
  };
}
```

---

## Шаг 2: Создать `expression.ts` — Рекурсивный Конвертер

```ts
// packages/transformer/src/expression.ts
import ts from 'typescript';
import {
  str, num, makeObject, makeArray,
  makeUnsupported, collectPropertyChain,
  UnsupportedNode
} from './utils';

const MAX_DEPTH = 64;

export function transformExpression(
  node: ts.Expression,
  paramName: string,
  factory: ts.NodeFactory,
  program: ts.Program,
  depth = 0
): ts.Expression {
  if (depth > MAX_DEPTH) {
    return makeUnsupported(factory, node, `Expression too deeply nested (max ${MAX_DEPTH})`, program);
  }

  const rec = (n: ts.Expression) =>
    transformExpression(n, paramName, factory, program, depth + 1);

  // --- BinaryExpression ---
  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind;

    // Логические операторы
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
      return makeObject(factory, {
        type: str(factory, 'LogicalExpression'),
        operator: str(factory, '&&'),
        left: rec(node.left),
        right: rec(node.right),
      });
    }
    if (op === ts.SyntaxKind.BarBarToken) {
      return makeObject(factory, {
        type: str(factory, 'LogicalExpression'),
        operator: str(factory, '||'),
        left: rec(node.left),
        right: rec(node.right),
      });
    }
    if (op === ts.SyntaxKind.QuestionQuestionToken) {
      // Nullish coalescing — возвращаем коалесценс как BinaryExpression
      return makeObject(factory, {
        type: str(factory, 'BinaryExpression'),
        operator: str(factory, '??'),
        left: rec(node.left),
        right: rec(node.right),
      });
    }

    // Сравнения
    const opMap: Partial<Record<ts.SyntaxKind, string>> = {
      [ts.SyntaxKind.EqualsEqualsEqualsToken]: '===',
      [ts.SyntaxKind.ExclamationEqualsEqualsToken]: '!==',
      [ts.SyntaxKind.EqualsEqualsToken]: '==',
      [ts.SyntaxKind.ExclamationEqualsToken]: '!=',
      [ts.SyntaxKind.GreaterThanToken]: '>',
      [ts.SyntaxKind.GreaterThanEqualsToken]: '>=',
      [ts.SyntaxKind.LessThanToken]: '<',
      [ts.SyntaxKind.LessThanEqualsToken]: '<=',
    };
    const sqlOp = opMap[op];
    if (sqlOp) {
      return makeObject(factory, {
        type: str(factory, 'BinaryExpression'),
        operator: str(factory, sqlOp),
        left: rec(node.left),
        right: rec(node.right),
      });
    }

    return makeUnsupported(factory, node, `Binary operator ${ts.SyntaxKind[op]}`, program);
  }

  // --- PrefixUnaryExpression: !expr ---
  if (ts.isPrefixUnaryExpression(node)) {
    if (node.operator === ts.SyntaxKind.ExclamationToken) {
      return makeObject(factory, {
        type: str(factory, 'UnaryExpression'),
        operator: str(factory, '!'),
        operand: rec(node.operand),
      });
    }
    return makeUnsupported(factory, node, `Unary operator ${ts.SyntaxKind[node.operator]}`, program);
  }

  // --- CallExpression: u.name.includes('x'), arr.includes(u.id) ---
  if (ts.isCallExpression(node)) {
    return transformCallExpression(node, paramName, factory, program, depth, rec);
  }

  // --- PropertyAccessExpression / OptionalChaining: u.age, u?.age ---
  if (ts.isPropertyAccessExpression(node)) {
    const chain = collectPropertyChain(node);
    if (chain && chain.root === paramName) {
      // Это обращение к полю параметра
      const fieldPath = chain.segments.join('.');
      return makeObject(factory, {
        type: str(factory, 'MemberExpression'),
        field: str(factory, fieldPath),
        optional: factory.createIdentifier(chain.hasOptional ? 'true' : 'false'),
      });
    }
    // Не часть параметра — это константное выражение или внешняя переменная
    return makeObject(factory, {
      type: str(factory, 'ExternalValue'),
      node: node, // оставляем как runtime значение
    });
  }

  // --- Identifier: u (сам параметр) или внешние переменные ---
  if (ts.isIdentifier(node)) {
    if (node.text === paramName) {
      return makeObject(factory, {
        type: str(factory, 'ParameterRef'),
        name: str(factory, paramName),
      });
    }
    // Внешняя переменная — оставляем как runtime значение
    return makeObject(factory, {
      type: str(factory, 'Literal'),
      value: node, // runtime ref
    });
  }

  // --- Literals ---
  if (ts.isStringLiteral(node)) {
    return makeObject(factory, {
      type: str(factory, 'Literal'),
      value: str(factory, node.text),
    });
  }
  if (ts.isNumericLiteral(node)) {
    return makeObject(factory, {
      type: str(factory, 'Literal'),
      value: num(factory, Number(node.text)),
    });
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return makeObject(factory, {
      type: str(factory, 'Literal'),
      value: factory.createTrue(),
    });
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return makeObject(factory, {
      type: str(factory, 'Literal'),
      value: factory.createFalse(),
    });
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return makeObject(factory, {
      type: str(factory, 'Literal'),
      value: factory.createNull(),
    });
  }

  // --- ArrayLiteralExpression: ['a', 'b'].includes(u.field) обрабатывается в Call ---
  if (ts.isArrayLiteralExpression(node)) {
    return makeObject(factory, {
      type: str(factory, 'ArrayLiteral'),
      elements: makeArray(factory, node.elements.map(e => rec(e))),
    });
  }

  // --- Всё остальное ---
  return makeUnsupported(factory, node, syntaxKindDescription(node), program);
}

function transformCallExpression(
  node: ts.CallExpression,
  paramName: string,
  factory: ts.NodeFactory,
  program: ts.Program,
  depth: number,
  rec: (n: ts.Expression) => ts.Expression
): ts.Expression {
  const expr = node.expression;
  if (!ts.isPropertyAccessExpression(expr)) {
    return makeUnsupported(factory, node, 'Non-property-access call', program);
  }

  const methodName = expr.name.text;
  const callee = expr.expression;

  // u.name.includes('substr') / u.name.startsWith('x') / u.name.endsWith('x')
  if (['includes', 'startsWith', 'endsWith'].includes(methodName)) {
    const chain = collectPropertyChain(callee);
    
    // arr.includes(u.field) — IN pattern
    if (
      methodName === 'includes' &&
      (!chain || chain.root !== paramName)
    ) {
      const arg = node.arguments[0];
      if (!arg) return makeUnsupported(factory, node, 'includes() with no arguments', program);
      
      const argChain = collectPropertyChain(arg);
      if (argChain && argChain.root === paramName) {
        return makeObject(factory, {
          type: str(factory, 'InExpression'),
          field: str(factory, argChain.segments.join('.')),
          values: rec(callee), // массив
        });
      }
    }

    // u.name.includes(x) — LIKE / string method
    if (chain && chain.root === paramName) {
      const arg = node.arguments[0];
      const sqlMethodMap: Record<string, string> = {
        includes: 'CONTAINS',
        startsWith: 'STARTS_WITH',
        endsWith: 'ENDS_WITH',
      };
      return makeObject(factory, {
        type: str(factory, 'StringMethod'),
        method: str(factory, sqlMethodMap[methodName]!),
        field: str(factory, chain.segments.join('.')),
        argument: arg ? rec(arg) : factory.createNull(),
      });
    }
  }

  return makeUnsupported(factory, node, `Call to .${methodName}()`, program);
}

function syntaxKindDescription(node: ts.Node): string {
  return `SyntaxKind.${ts.SyntaxKind[node.kind] ?? node.kind}`;
}
```

---

## Шаг 3: Переписать `index.ts` — Новый Scope Guard и Трансформация

```ts
// packages/transformer/src/index.ts
import ts from 'typescript';
import { transformExpression } from './expression';
import { makeObject, str, makeArray } from './utils';

const BRAND_PROPERTY = '__tsLinqWhereTransformerBrand';
const TARGET_METHODS = new Set(['where', 'having', 'whereCompiled', 'havingCompiled']);

export default function createTransformerPlugin(
  program: ts.Program
): ts.TransformerFactory<ts.SourceFile> {
  const checker = program.getTypeChecker();
  
  return (context) => {
    const { factory } = context;
    
    return (sourceFile) => {
      return ts.visitNode(sourceFile, visitNode) as ts.SourceFile;
      
      function visitNode(node: ts.Node): ts.Node {
        if (ts.isCallExpression(node)) {
          const transformed = tryTransformCall(node);
          if (transformed) return transformed;
        }
        return ts.visitEachChild(node, visitNode, context);
      }
      
      function tryTransformCall(call: ts.CallExpression): ts.CallExpression | null {
        if (!ts.isPropertyAccessExpression(call.expression)) return null;
        
        const methodName = call.expression.name.text;
        if (!TARGET_METHODS.has(methodName)) return null;
        
        // Scope guard: проверить type brand
        const objectType = checker.getTypeAtLocation(call.expression.expression);
        const hasBrand = objectType.getProperties().some(p => p.name === BRAND_PROPERTY);
        if (!hasBrand) return null;
        
        // Уже трансформировано (whereCompiled/havingCompiled) — не трогать
        if (methodName === 'whereCompiled' || methodName === 'havingCompiled') return null;
        
        const [predicateArg] = call.arguments;
        if (!predicateArg) return null;
        
        // Извлечь параметр функции
        if (
          !ts.isArrowFunction(predicateArg) &&
          !ts.isFunctionExpression(predicateArg)
        ) return null;
        
        const param = predicateArg.parameters[0];
        if (!param || !ts.isIdentifier(param.name)) return null;
        const paramName = param.name.text;
        
        const body = predicateArg.body;
        const bodyExpr = ts.isBlock(body)
          ? extractReturnExpression(body)
          : body;
        
        if (!bodyExpr) return null;
        
        // Трансформировать
        const compiledMethod = methodName === 'where' ? 'whereCompiled' : 'havingCompiled';
        const ast = transformExpression(bodyExpr, paramName, factory, program);
        
        const compiledArg = makeObject(factory, {
          ast: ast,
          source: str(factory, predicateArg.getText(sourceFile)),
        });
        
        return factory.updateCallExpression(
          call,
          factory.updatePropertyAccessExpression(
            call.expression as ts.PropertyAccessExpression,
            (call.expression as ts.PropertyAccessExpression).expression,
            factory.createIdentifier(compiledMethod)
          ),
          call.typeArguments,
          [compiledArg, ...call.arguments.slice(1)]
        );
      }
    };
  };
}

function extractReturnExpression(block: ts.Block): ts.Expression | null {
  for (const stmt of block.statements) {
    if (ts.isReturnStatement(stmt) && stmt.expression) {
      return stmt.expression;
    }
  }
  return null;
}
```

---

## Шаг 4: Обновить Runtime-Обработчики в Queryable

Текущие `whereCompiled` / `havingCompiled` принимают `{ ast, parameters }`. После миграции структура `ast` расширится новыми типами узлов. Нужно обновить visitor в `BinaryVisitor`/`LogicalVisitor`.

### Новые типы узлов для добавления в runtime

```ts
// packages/core/src/query/visitors/ExpressionVisitor.ts (новый файл)

export type ExpressionNode =
  | BinaryExpressionNode       // >, <, ===, !==, ??
  | LogicalExpressionNode      // &&, ||
  | UnaryExpressionNode        // !
  | MemberExpressionNode       // u.age, u.profile.name
  | LiteralNode                // 'string', 42, true, null
  | InExpressionNode           // arr.includes(u.id) → id IN (...)
  | StringMethodNode           // u.name.includes('x') → LIKE '%x%'
  | ArrayLiteralNode           // ['a', 'b']
  | UnsupportedNode;           // sentinel — должен вызывать ошибку runtime

// --- StringMethod → SQL ---
// CONTAINS  → LIKE '%value%'
// STARTS_WITH → LIKE 'value%'
// ENDS_WITH   → LIKE '%value'

// --- InExpression → SQL ---
// { type: 'InExpression', field: 'id', values: ArrayLiteralNode }
// → "id IN (?, ?, ?)" с параметрами

// --- UnaryExpression: ! ---
// { type: 'UnaryExpression', operator: '!', operand: BinaryExpression }
// → "NOT (condition)"
```

### Обновление BinaryVisitor

```ts
// В BinaryVisitor.visit():
case 'UnaryExpression':
  if (node.operator === '!') {
    const inner = this.visit(node.operand);
    return { condition: `NOT (${inner.condition})`, parameters: inner.parameters };
  }
  break;

case 'InExpression':
  const placeholders = node.values.elements.map(() => '?').join(', ');
  const values = node.values.elements.map(e => this.extractLiteral(e));
  // Получить columnName из метаданных
  const colName = this.resolveColumnName(node.field);
  return { condition: `${colName} IN (${placeholders})`, parameters: values };

case 'StringMethod':
  const colName = this.resolveColumnName(node.field);
  const arg = this.extractLiteral(node.argument);
  const likeValue = {
    CONTAINS:    `%${arg}%`,
    STARTS_WITH: `${arg}%`,
    ENDS_WITH:   `%${arg}`,
  }[node.method];
  return { condition: `${colName} LIKE ?`, parameters: [likeValue] };
```

---

## Шаг 5: Удалить Старые Файлы

После полной миграции удалить:
- `packages/transformer/src/WhereTransformer.ts`
- `packages/transformer/src/ExpressionParser.ts`
- `packages/transformer/src/AstHelpers.ts`
- `packages/transformer/src/NodeFactory.ts`
- `packages/transformer/src/TypeExtractor.ts`

---

## Шаг 6: Обновить Тесты

### Текущий подход к тестам

Текущие тесты (если есть) вероятно используют `ts-jest` или просто проверяют runtime. Нужно добавить compile-time тесты — как в project2:

```ts
// packages/transformer/tests/transformer.test.ts

import ts from 'typescript';
import path from 'path';

function compile(source: string): { output: string; errors: ts.Diagnostic[] } {
  const fileName = path.resolve(__dirname, '__test__.ts');
  
  const host = ts.createCompilerHost({});
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, lang) => {
    if (name === fileName) return ts.createSourceFile(fileName, source, lang, true);
    return originalGetSourceFile(name, lang);
  };
  
  const program = ts.createProgram([fileName], {
    strict: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
  }, host);
  
  // Применить трансформер
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
    transformers: {
      before: [createTransformerPlugin(program)],
    },
  });
  
  return {
    output: result.outputText,
    errors: ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error),
  };
}

// Тесты

test('transforms simple where', () => {
  const { output } = compile(`
    declare const q: { __tsLinqWhereTransformerBrand: unique symbol; where(fn: (u: any) => boolean): any };
    q.where(u => u.age > 18);
  `);
  expect(output).toContain('whereCompiled');
  expect(output).toContain('"type":"BinaryExpression"');
  expect(output).toContain('"operator":">"');
});

test('transforms OR condition', () => {
  const { output } = compile(`
    declare const q: { __tsLinqWhereTransformerBrand: unique symbol; where(fn: (u: any) => boolean): any };
    q.where(u => u.age > 18 || u.role === 'admin');
  `);
  expect(output).toContain('"operator":"||"');
});

test('transforms IS NULL', () => {
  const { output } = compile(`
    declare const q: { __tsLinqWhereTransformerBrand: unique symbol; where(fn: (u: any) => boolean): any };
    q.where(u => u.deletedAt === null);
  `);
  expect(output).toContain('"type":"BinaryExpression"');
});

test('transforms IN pattern', () => {
  const { output } = compile(`
    declare const q: { __tsLinqWhereTransformerBrand: unique symbol; where(fn: (u: any) => boolean): any };
    const roles = ['admin', 'user'];
    q.where(u => roles.includes(u.role));
  `);
  expect(output).toContain('"type":"InExpression"');
});

test('transforms string methods', () => {
  const { output } = compile(`
    declare const q: { __tsLinqWhereTransformerBrand: unique symbol; where(fn: (u: any) => boolean): any };
    q.where(u => u.name.startsWith('John'));
  `);
  expect(output).toContain('"type":"StringMethod"');
  expect(output).toContain('"method":"STARTS_WITH"');
});

test('transforms nested path', () => {
  const { output } = compile(`
    declare const q: { __tsLinqWhereTransformerBrand: unique symbol; where(fn: (u: any) => boolean): any };
    q.where(u => u.profile.city === 'NY');
  `);
  expect(output).toContain('"field":"profile.city"');
});

test('emits error for unsupported expression', () => {
  const { errors } = compile(`
    declare const q: { __tsLinqWhereTransformerBrand: unique symbol; where(fn: (u: any) => boolean): any };
    q.where(u => u.name.match(/test/));
  `);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors[0]?.messageText).toContain('Unsupported expression');
});

test('does not transform unbranded type', () => {
  const { output } = compile(`
    const q = { where: (fn: any) => q };
    q.where((u: any) => u.age > 18);
  `);
  expect(output).not.toContain('whereCompiled');
  expect(output).toContain('where(');
});
```

---

## Шаг 7: Обновить tsconfig.json Трансформера

```json
// packages/transformer/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

---

## Шаг 8: Обновить ts-patch Конфигурацию

Пользователи настраивают трансформер в `tsconfig.json`:

```json
// До миграции:
{
  "compilerOptions": {
    "plugins": [
      { "transform": "@ts-linq/transformer", "type": "program" }
    ]
  }
}

// После миграции — без изменений для пользователя (обратно-совместимо)
```

---

## Breaking Changes

### Для авторов плагина

| Что меняется | Старое поведение | Новое поведение |
|---|---|---|
| Scope guard | Проверка пути файла | Type brand `__tsLinqWhereTransformerBrand` |
| Ошибки трансформации | `throw new Error(...)` — падает весь компилятор | Sentinel + `process.stderr` — компилируется с предупреждениями |
| Поддерживаемые операторы | только `&&` | `&&`, `\|\|`, `!`, сравнения |
| Методы строк | не поддерживаются | `.includes()`, `.startsWith()`, `.endsWith()` |
| IN-паттерн | не поддерживается | `arr.includes(u.field)` |
| Nested paths | частично | `u.profile.city` полностью поддержан |
| Optional chaining | нет | `u?.profile?.city` |

### Для пользователей библиотеки

**Нет breaking changes для пользователей** — `where(u => ...)` продолжает работать. Расширяется набор поддерживаемых выражений.

Единственное потенциальное breaking change: если пользователь создаёт класс с полем `__tsLinqWhereTransformerBrand` — крайне маловероятно на практике.

---

## Порядок Реализации

```
День 1:
  ✅ Добавить type brand в Queryable и TypedQueryable (Шаг 0)
  ✅ Создать utils.ts с хелперами (Шаг 1)

День 2:
  ✅ Реализовать expression.ts (Шаг 2)
  ✅ Переписать index.ts со scope guard (Шаг 3)

День 3:
  ✅ Обновить BinaryVisitor / runtime handlers (Шаг 4)
  ✅ Написать тесты (Шаг 6)

День 4:
  ✅ Удалить старые файлы (Шаг 5)
  ✅ Проверить end-to-end с реальным SQLite
  ✅ Обновить CHANGELOG / документацию
```

---

## Риски и Митигация

| Риск | Вероятность | Митигация |
|---|---|---|
| TypeChecker недоступен в некоторых режимах ts-patch | Средняя | Fallback: проверять имя метода `.where` + наличие сигнатуры с callback |
| Пользователи используют `where` на собственных типах без бренда | Низкая | Scope guard предотвращает ложные трансформации |
| Sentinel `unsupported` попадает в runtime | Средняя | Runtime check в `whereCompiled()`: если `ast.type === 'unsupported'` — throw с понятным сообщением |
| Новые AST-типы ломают старый BinaryVisitor | Высокая | Добавить default case с throw в switch — упадёт при первом тесте, не в проде |
