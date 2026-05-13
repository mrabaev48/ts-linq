# Issue #18 — `join()` / `leftJoin()` парсят ON-предикат в рантайме через `.toString()`

**Severity:** High  
**Status:** Открыт  
**Affected files:**
- `packages/query/src/Queryable.ts` — `addJoin()` (~892–915)
- `packages/query/src/JoinPredicateParser.ts` — `parse()` (весь файл)

---

## Описание проблемы

`join()` и `leftJoin()` принимают двухпараметрическую стрелочную функцию и немедленно вызывают на ней `.toString()`, после чего `JoinPredicateParser` разбирает полученную строку регулярным выражением:

```ts
// Queryable.ts ~902
const onStr = this.parseJoinPredicate(
  on.toString(),           // ← рантайм toString на функции
  leftMeta.tableName,
  rightMeta.tableName,
  leftMeta,
  rightMeta
);

// JoinPredicateParser.ts
const match = onStr.match(
  /\((\w+)\s*,\s*(\w+)\)\s*=>\s*\1\.(\w+)\s*===?\s*\2\.(\w+)/
);
if (!match) throw new Error(`Unable to parse join predicate: ${onStr}`);
```

Это та же проблема, что была решена в issue #17 для `where()`, `orderBy()`, `select()` и агрегатов — только здесь предикат двухпараметрический, поэтому `keyof T` не достаточно.

---

## Почему это проблема

### 1. Ломается при минификации

После minify `(a, b) => a.authorId === b.id` превращается в `(a,b)=>a.a===b.b`. Регекс совпадёт, но вместо `authorId` и `id` SQL получит `a` и `b` — несуществующие колонки.

### 2. Поддерживает только один паттерн

Регекс поддерживает ровно одну форму:
```ts
(a, b) => a.prop === b.other
```

Любой из следующих случаев — `Error('Unable to parse join predicate')`:
```ts
(a, b) => a.id === b.userId && a.tenantId === b.tenantId  // составной ключ
(a, b) => b.authorId === a.id                             // обратный порядок
(left, right) => left['id'] === right['bookId']           // bracket notation
```

### 3. Несогласованность с остальным API

После issue #17 все публичные методы Queryable либо используют `keyof T`, либо трансформер (`whereCompiled`, `selectCompiled`, `havingCompiled`). `join()` — единственный публичный метод, который по-прежнему тихо делает рантайм-парсинг.

---

## Предлагаемое решение

### Вариант A — `joinOn(leftKey, rightKey)` для простых равенств

Для наиболее распространённого случая (JOIN по одному ключу) — принять два `keyof` параметра:

```ts
// БЫЛО:
context.books.join(Author, (b, a) => b.authorId === a.id)

// СТАНЕТ:
context.books.joinOn(Author, 'authorId', 'id')
// или явно:
context.books.joinOn(Author, { left: 'authorId', right: 'id' })
```

Сигнатура:
```ts
public joinOn<TOther>(
  otherCtor: new () => TOther,
  leftKey: keyof T & string,
  rightKey: keyof TOther & string,
  alias?: string
): Queryable<T>
```

Никакого `.toString()`, никакого regex. TypeScript статически проверяет оба ключа.

### Вариант B — `joinCompiled()` через трансформер (для сложных случаев)

Для составных ключей и нетривиальных ON-условий — трансформер переписывает `join()` в `joinCompiled()` с уже вычисленными именами колонок:

```ts
// Исходный код (до компиляции):
context.books.join(Author, (b, a) => b.authorId === a.id)

// После трансформации:
context.books.joinCompiled(Author, {
  leftKey: 'author_id',  // уже columnName из метаданных
  rightKey: 'id'
})
```

---

## Что нужно сделать

1. Добавить `joinOn<TOther>(otherCtor, leftKey, rightKey, alias?)` как замену `join()` / `leftJoin()` для простых равенств
2. `join()` и `leftJoin()` — выбросить `Error` с подсказкой (аналогично `where()`), либо задепрекейтить с предупреждением
3. Удалить `JoinPredicateParser.ts` (весь файл)
4. Удалить `parseJoinPredicate()` из `Queryable.ts`
5. Удалить `addJoin()` — заменить инлайном в `joinOn()` / `leftJoinOn()`
6. Обновить все тесты, использующие `join((a, b) => ...)` → `joinOn('key', 'key')`
