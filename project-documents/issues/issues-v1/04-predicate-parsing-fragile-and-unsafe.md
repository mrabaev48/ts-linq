# Issue #04 — Runtime Парсинг Предикатов через `Function.toString()`: Хрупко, Небезопасно, Непредсказуемо

**Severity:** High  
**Category:** Architecture / Correctness / Security  
**Affected files:**
- `packages/core/src/query/PredicateParser.ts`
- `packages/core/src/query/Queryable.ts` (методы `where`, `orderBy`, `groupBy`, `select`, `include`)
- `packages/core/src/query/JoinPredicateParser.ts`

---

## Описание проблемы

`PredicateParser` преобразует функцию-предикат в SQL-условие через анализ строки `predicate.toString()` с помощью регулярных выражений:

```ts
export class PredicateParser<T> {
  public parse(predicate: (entity: T) => boolean): ExpressionNode | null {
    const str = predicate.toString(); // "u => u.age > 18 && u.isActive === true"
    // ...regex matching...
  }
}
```

Аналогично, `orderBy`, `groupBy`, `select`, `include` — все разбирают лямбды через `toString()`:

```ts
public orderBy<TKey>(keySelector: (entity: T) => TKey): Queryable<T> {
  const keySelectorStr = keySelector.toString(); // "(u) => u.name"
  const column = this.extractPropertyFromKeySelector(keySelectorStr); // regex
  ...
}
```

---

## Технические сложности

### 1. Полная несовместимость с минификацией

После минификации (terser, esbuild, swc) стрелочные функции теряют читаемые имена:

```js
// До минификации:
u => u.firstName
// После:
n => n.a
```

Regex `REGEX_SINGLE_PROP = /=>\s*\w+\.(\w+)/` извлечёт `"a"` вместо `"firstName"`. Запрос будет генерировать `WHERE a = ?` — несуществующий столбец.

Это означает, что `ts-linq` **нельзя использовать в production-сборках** с минификацией без дополнительных настроек в бандлере. Никакого предупреждения об этом в документации нет.

### 2. Тихий fallback к полной загрузке всех строк

Когда `PredicateParser.parse()` возвращает `null` (не смог разобрать), предикат сохраняется как `_fallbackPredicates` и применяется **после загрузки ВСЕХ строк**:

```ts
private addWhereOrFallback(predicate: (entity: T) => boolean): void {
  const ast = parser.parse(predicate);
  if (!ast) {
    this._fallbackPredicates.push(predicate); // ← тихо загружает всё!
    return;
  }
  // ...добавляем WHERE в SQL...
}
```

Пользователь пишет `where(u => u.age > 18)`, ожидает `WHERE age > 18`, а получает `SELECT * FROM users` + фильтрацию 10M строк в памяти Node.js. Без единого предупреждения.

### 3. Ограниченный набор поддерживаемых выражений

Поддерживаются только:
- `===`, `==`, `>`, `>=`, `<`, `<=`
- `&&` (AND)
- `entity.property op literal`

Не поддерживаются:
- `||` (OR) — явно в `UNSUPPORTED_TOKENS`
- `!` (NOT) — переходит в fallback
- `?.` (optional chaining) — не поддерживается
- `entity.nested.property` — не поддерживается
- переменные в правой части: `u.age > minAge` — `minAge` не парсится как literal
- вызовы методов: `u.name.includes('test')` — fallback
- сравнение с другим свойством: `u.startDate < u.endDate` — fallback

Для любого из этих случаев молча загружается вся таблица.

### 4. Кэш предикатов по `predicate.toString()` — collision-prone

```ts
private static _predicateSqlCache: Map<string, WhereClause> = new Map();
// Ключ: "(u) => u.age > 18"
```

Два разных предиката с одинаковым телом, но для разных сущностей с разными именами колонок:

```ts
// Entity User: { age -> "user_age" }
// Entity Product: { age -> "product_age" }
where((u) => u.age > 18) // на User → WHERE user_age > ?
where((p) => p.age > 18) // на Product → cache hit → WHERE user_age > ? (НЕВЕРНО)
```

Кэш не учитывает тип сущности в ключе.

### 5. SQL Injection через имя свойства

`BinaryVisitor` генерирует:

```ts
return { condition: `${column} ${op} ?`, parameters: [value] };
```

`column` здесь — это `node.left.name`, извлечённый regex-ом из лямбды. Если имя свойства содержит специальные символы SQL (что маловероятно, но возможно через декораторы с кастомными columnName), это может привести к инъекции.

Более серьёзно: `column` — это **имя свойства JS** (`propertyName`), а не **имя столбца в БД** (`columnName`). Если они разные (`@Column({ name: 'user_age' }) age: number`), SQL будет использовать `age` вместо `user_age`.

### 6. Compile-time трансформер добавляет сложность инфраструктуры

README описывает `@ts-linq/transformer` через `ts-patch`, но:
- Требует установки `ts-patch install` — дополнительный шаг сборки
- Компиляция должна идти через `tspc`, а не `tsc` — несовместимо со многими CI/CD пайплайнами
- В README: "Runtime `PredicateParser` has been removed" — но он всё ещё в коде и активно используется в `having()` и в `addWhereOrFallback` как fallback
- Если трансформер не подключён и вызывается `where()` — выбрасывается исключение: `"ts-linq(where): compile-time transformer is required..."` (но только в части путей, не везде)

---

## Предлагаемое решение

### Вариант A: Полный переход на compile-time (рекомендуется)

Убрать `PredicateParser` и `Function.toString()` полностью. Все операции с предикатами (`where`, `having`, `orderBy`) должны использовать только `whereCompiled` API.

```ts
// Публичный API с ошибкой при отсутствии трансформера:
public where(predicate: (entity: T) => boolean): Queryable<T> {
  throw new Error(
    'ts-linq: compile-time transformer required. ' +
    'Add @ts-linq/transformer to tsconfig.json plugins and compile with tspc. ' +
    'See: https://...'
  );
}

// Реальный путь через трансформер:
public whereCompiled(compiled: { ast: ExpressionNode; parameters: SqlParameter[] }): Queryable<T> {
  // ...работает напрямую с AST...
}
```

### Вариант B: Typed Query Builder без лямбд (как Knex / Drizzle)

```ts
// Без лямбд — без парсинга, полностью type-safe:
ctx.users
  .where('age', '>', 18)
  .where('isActive', '=', true)
  .orderBy('name', 'ASC')
  .toArray()
```

### Вариант C: Минимальный фикс — предупреждать о fallback к memory filter

Если `PredicateParser` оставить, то хотя бы логировать предупреждение при fallback:

```ts
if (!ast) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      `[ts-linq] Predicate "${str.slice(0, 60)}..." could not be translated to SQL. ` +
      'All rows will be fetched and filtered in memory. ' +
      'Consider using the compile-time transformer.'
    );
  }
  this._fallbackPredicates.push(predicate);
}
```

И исправить кэш-ключ предиката:

```ts
const cacheKey = `${this._entityClass.name}::${predicate.toString()}`;
```
