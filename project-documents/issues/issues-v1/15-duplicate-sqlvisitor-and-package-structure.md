# Issue #15 — Дублирование Кода: Два `SqlVisitor`, Разрозненная Структура Пакетов

**Severity:** Medium  
**Category:** Maintainability / Code Organization  
**Affected files:**
- `packages/core/src/query/SqlVisitor.ts`
- `packages/core/src/query/ast/SqlVisitor.ts`
- `packages/core/src/query/Nodes.ts`
- `packages/core/src/query/ast/Nodes.ts`
- Структура пакетов в `packages/`

---

## Описание проблемы

### Проблема A: Два идентичных `SqlVisitor`

В проекте существуют два файла с практически идентичным кодом:

```ts
// packages/core/src/query/SqlVisitor.ts:
export class SqlVisitor {
  private readonly binary = new BinaryVisitor();
  private readonly logical = new LogicalVisitor();
  
  public toSql(node: ExpressionNode): { condition: string; parameters: SqlParameter[] } {
    if (node.type === 'BinaryExpression') return this.binary.visit(node as BinaryExpressionNode);
    if (node.type === 'LogicalExpression')
      return this.logical.visit(node as LogicalExpressionNode, this.toSql.bind(this));
    return { condition: '1=1', parameters: [] };
  }
}

// packages/core/src/query/ast/SqlVisitor.ts:
export class SqlVisitor {
  private readonly binary = new BinaryVisitor();
  private readonly logical = new LogicalVisitor();
  
  public toSql(node: ExpressionNode): { condition: string; parameters: SqlParameter[] } {
    if (node.type === 'BinaryExpression') return this.binary.visit(node as BinaryExpressionNode);
    if (node.type === 'LogicalExpression')
      return this.logical.visit(node as LogicalExpressionNode, (n) => this.toSql(n));
    return { condition: '1=1', parameters: [] };
  }
}
```

Единственное отличие: `this.toSql.bind(this)` vs `(n) => this.toSql(n)` — функционально эквивалентно.

### Проблема B: Два набора AST Nodes

```ts
// packages/core/src/query/Nodes.ts — старый путь
// packages/core/src/query/ast/Nodes.ts — новый путь
```

Каждый `SqlVisitor` импортирует из "своей" папки.

### Проблема C: Структура пакетов расходится с package.json

В `package.json` root-пакет декларирует:
```json
"exports": {
  ".": "./packages/core/dist/esm/index.js",
  "./provider-postgres": "./packages/provider-postgres/dist/esm/index.js",
  ...
}
```

Но в папке `packages/` имена пакетов иные:
```
packages/postgres/   → package.json: "@ts-linq/postgres" (а не "@ts-linq/provider-postgres")
packages/mysql/      → package.json: "@ts-linq/mysql"
packages/mssql/      → package.json: "@ts-linq/mssql"
```

Экспорт в root `package.json` указывает на `provider-postgres`, но пакет называется `@ts-linq/postgres`. Несоответствие между именами пакетов и путями экспорта.

### Проблема D: Пакеты без корректного `package.json` имени

```
packages/composite-sql-logger/package.json: "name": "composite-sql-logger"
packages/metrics-safe/package.json:         "name": "metrics-safe"
packages/open-telemetry-sql-logger/....:    "name": "open-telemetry-sql-logger"
packages/prometheus-sql-logger/...:         "name": "prometheus-sql-logger"
```

Эти пакеты не имеют scope (`@ts-linq/`), что делает их неотличимыми от произвольных npm-пакетов при импорте. Если пользователь случайно установит npm-пакет с именем `metrics-safe` — произойдёт конфликт.

---

## Технические сложности

### 1. Двойной `SqlVisitor` — риск расхождения при изменениях

Когда разработчик изменяет логику обработки AST (добавляет новый тип узла, исправляет баг), нужно помнить обновить оба файла. Вероятность, что один будет забыт — высокая.

### 2. Импорты из разных путей создают путаницу

```ts
// В Queryable.ts:
import { SqlVisitor } from './ast/SqlVisitor';

// В PredicateParser.ts:
import { SqlVisitor } from './SqlVisitor'; // или './ast/SqlVisitor'?
```

Неясно, какой именно `SqlVisitor` используется в каждом месте. При добавлении нового разработчика это вызывает confusion.

### 3. Несоответствие имён пакетов нарушает workspace-резолюцию

В `package.json` воркспейс:
```json
"workspaces": [
  "packages/*",
  "packages/open-telemetry-sql-logger",
  "packages/prometheus-sql-logger",
  "packages/composite-sql-logger"
]
```

Дублирование: `packages/*` уже включает все папки в packages/, поэтому явные записи для логгеров избыточны.

Важнее: `packages/core/src` импортирует `from 'metrics-safe'`:
```ts
import { safeCache, safeCacheEvicted, safeCacheSize } from 'metrics-safe';
```

Это не scoped имя, что означает — если пользователь установит рандомный npm-пакет с именем `metrics-safe`, это сломает код.

---

## Предлагаемое решение

### Шаг 1: Удалить дублирующий `SqlVisitor` и `Nodes`

```
Оставить:          packages/core/src/query/ast/SqlVisitor.ts
                   packages/core/src/query/ast/Nodes.ts
Удалить:           packages/core/src/query/SqlVisitor.ts (старый)
                   packages/core/src/query/Nodes.ts (старый)
Обновить импорты:  везде использовать import from './ast/SqlVisitor'
```

### Шаг 2: Переименовать пакеты с добавлением scope

```
"metrics-safe"               → "@ts-linq/metrics-safe"
"composite-sql-logger"       → "@ts-linq/composite-sql-logger"
"open-telemetry-sql-logger"  → "@ts-linq/otel-sql-logger"
"prometheus-sql-logger"      → "@ts-linq/prometheus-sql-logger"
```

Обновить все внутренние импорты.

### Шаг 3: Синхронизировать имена папок с именами пакетов

```
packages/postgres/ → packages/provider-postgres/ (или наоборот — привести к единому стилю)
packages/mysql/    → packages/provider-mysql/
packages/mssql/    → packages/provider-mssql/
```

И обновить `package.json` exports соответственно.

### Шаг 4: Исправить `workspaces` в root `package.json`

```json
"workspaces": [
  "packages/*"
]
// Удалить явные дубли — glob packages/* уже покрывает всё
```

---

## Карта дублирования кода

| Файл A | Файл B | Различие |
|---|---|---|
| `query/SqlVisitor.ts` | `query/ast/SqlVisitor.ts` | `bind(this)` vs arrow fn |
| `query/Nodes.ts` | `query/ast/Nodes.ts` | возможно идентичны |
| `Queryable.ts` (материализация) | `RowMaterializer.ts` | дублирование логики (Issue #05) |
