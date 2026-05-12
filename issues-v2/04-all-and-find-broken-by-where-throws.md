# Issue #04 — `all()` и `DbSet.find()` Сломаны: Внутренние Вызовы `where()` Теперь Бросают

**Severity:** Critical (Регрессия)  
**Status:** Новая проблема, введена в текущей версии  
**Affected files:**
- `packages/query/src/Queryable.ts` (методы `all`)
- `packages/orm/src/DbSet.ts` (метод `find`)

---

## Описание проблемы

В текущей версии `where()` намеренно бросает исключение, требуя compile-time трансформер:

```ts
// packages/query/src/Queryable.ts:233-239
public where(predicate: (entity: T) => boolean): Queryable<T> {
  throw new Error(
    "ts-linq(where): compile-time transformer is required. Configure ts-patch plugin '@ts-linq/transformer'."
  );
}
```

Это правильное поведение для пользователей. Но проблема в том, что **`all()` и `DbSet.find()` сами вызывают `where()` внутри**.

## Метод `all()` — всегда бросает

```ts
// packages/query/src/Queryable.ts:1375-1382
public async all(predicate: (entity: T) => boolean): Promise<boolean> {
  if (this._abortSignal?.aborted) throw new Error('Operation aborted');

  // ← Вызывает where(), которая теперь бросает!
  const violatingElement = await this.where((entity) => !predicate(entity)).firstOrDefault();
  return violatingElement === null;
}
```

Любой вызов `ctx.users.all(u => u.age > 18)` завершится ошибкой:
```
Error: ts-linq(where): compile-time transformer is required.
```

Даже при наличии трансформера — трансформер преобразует `.where()` снаружи,
но вызов `.where()` ВНУТРИ `all()` — это рантайм-вызов, трансформер его не видит.

## Метод `DbSet.find()` — всегда бросает

```ts
// packages/orm/src/DbSet.ts:88-99
public async find(id: PrimaryKeyOf<T>, options?: LoadingOptions): Promise<T | null> {
  ...
  const pk = metadata.primaryKeys[0] as keyof T & string;
  return await new Queryable<T>(...)
    .where((e) => (e as unknown as Record<string, unknown>)[pk] === id)  // ← бросает!
    .firstOrDefault();
}
```

Вызов `ctx.users.find(42)` всегда бросает исключение.

## Масштаб проблемы

```ts
// Всё это теперь СЛОМАНО:
const allAdult = await ctx.users.all(u => u.age >= 18);  // THROWS
const user = await ctx.users.find(userId);               // THROWS
const dbSet = ctx.set(User);
const found = await dbSet.find(42);                      // THROWS
```

`find()` — один из базовых методов ORM. `all()` — стандартный LINQ метод. Оба сломаны.

## Предлагаемое решение

### Для `all()`: переписать через `count()` или прямой SQL

```ts
public async all(predicate: (entity: T) => boolean): Promise<boolean> {
  if (this._abortSignal?.aborted) throw new Error('Operation aborted');
  // all() не может быть реализован без трансформера — нужен compile-time AST предиката.
  // До появления трансформерной версии: выбросить понятную ошибку.
  throw new Error(
    "ts-linq(all): compile-time transformer is required. Use allCompiled() or count() instead."
  );
}

// Добавить allCompiled() аналогично whereCompiled():
public async allCompiled(input: { readonly ast: ExpressionNode; readonly parameters: readonly SqlParameter[] }): Promise<boolean> {
  // Реализация через NOT EXISTS / count
  const count = await this.whereCompiled(input).count();
  return count === 0; // if no elements violate — all satisfy
}
```

### Для `DbSet.find()`: использовать `whereIn` или прямой provider call

```ts
public async find(id: PrimaryKeyOf<T>, options?: LoadingOptions): Promise<T | null> {
  if (this._entityLoader && options) {
    return await this._entityLoader.loadEntity(this._entityClass, id, options);
  }
  // Использовать whereIn вместо where() для PK lookup
  const metadata = MetadataStorage.getEntity(this._entityClass);
  if (!metadata || !metadata.primaryKeys || metadata.primaryKeys.length === 0) {
    return await this._provider.findById(id, this._entityClass);
  }
  const pk = metadata.primaryKeys[0] as keyof T & string;
  const results = await new Queryable<T>(...)
    .whereIn(pk, [id as T[typeof pk]])
    .firstOrDefault();
  return results;
}
```

`whereIn()` не использует `where()` — он напрямую строит `IN (?)` через `QueryModel`.
