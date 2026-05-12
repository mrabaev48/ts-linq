# Issue #07 — ChangeTracker Без Identity Map; JSON.parse/stringify

**Severity:** High  
**Status:** Остаётся (перемещён в `@ts-linq/orm`)  
**Affected files:**
- `packages/orm/src/ChangeTracker.ts`

---

## Описание проблемы

### 1. Object Reference вместо Primary Key

```ts
// packages/orm/src/ChangeTracker.ts:10
private _trackedEntities: Map<object, TrackedEntity> = new Map();
```

Ключ — object reference (`===` сравнение). Два объекта с одинаковым PK будут отслеживаться
как два разных изменения:

```ts
const user1 = await ctx.users.find(1);  // { id: 1, name: 'Alice' }
const user2 = await ctx.users.find(1);  // { id: 1, name: 'Alice' } — ДРУГОЙ объект

ctx.users.update(user1);
ctx.users.update(user2);

// ChangeTracker видит ДВА изменения: _trackedEntities.size === 2
// saveChanges() выпустит два UPDATE для одной строки
```

### 2. JSON.parse/JSON.stringify для клонирования

```ts
// packages/orm/src/ChangeTracker.ts:135-137
private cloneObject<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
```

Проблемы:
- `Date` → строка → не равна оригинальному `Date` объекту → ложные Modified
- `BigInt` → `TypeError: Do not know how to serialize a BigInt`
- `undefined` поля пропадают из клона → ложные Modified
- Циклические ссылки → `TypeError: Converting circular structure to JSON`
- Функции пропадают

### 3. areObjectsEqual через JSON.stringify — нестабильно

```ts
private areObjectsEqual<T>(obj1: T, obj2: T): boolean {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}
```

`JSON.stringify` не гарантирует порядок ключей. `{ a: 1, b: 2 }` и `{ b: 2, a: 1 }` 
могут дать разные строки в разных JS движках.

### 4. detectChanges() не вызывается автоматически

```ts
public detectChanges(): void {
  for (const tracked of this._trackedEntities.values()) {
    if (tracked.state === EntityState.Unchanged && tracked.originalValues) {
      if (!this.areObjectsEqual(tracked.entity, tracked.originalValues)) {
        tracked.state = EntityState.Modified;
      }
    }
  }
}
```

Этот метод никогда не вызывается из `saveChanges()`. Если пользователь изменил свойство
объекта напрямую (не через `update()`), изменение не будет сохранено.

## Предлагаемое решение

### Identity Map по первичному ключу

```ts
export class ChangeTracker {
  private _trackedByRef: Map<object, TrackedEntity> = new Map();
  private _trackedByPk: Map<Function, Map<unknown, TrackedEntity>> = new Map();

  private getPkValue(entity: object, entityClass: Function): unknown {
    const meta = MetadataStorage.getEntity(entityClass);
    const pk = meta?.primaryKeys?.[0];
    return pk ? (entity as Record<string, unknown>)[pk] : undefined;
  }

  public add<T extends object>(entity: T, entityClass: Function): void {
    const pkVal = this.getPkValue(entity, entityClass);
    if (pkVal !== undefined) {
      let pkMap = this._trackedByPk.get(entityClass);
      if (!pkMap) { pkMap = new Map(); this._trackedByPk.set(entityClass, pkMap); }
      if (pkMap.has(pkVal)) return; // уже отслеживается — дедупликация
      pkMap.set(pkVal, { entity, entityClass, state: EntityState.Added });
    }
    this._trackedByRef.set(entity, { entity, entityClass, state: EntityState.Added });
  }
}
```

### structuredClone вместо JSON.parse/stringify

```ts
private cloneObject<T>(obj: T): T {
  // structuredClone поддерживает Date, ArrayBuffer, Map, Set, BigInt
  // Доступен в Node.js 17+ и всех современных браузерах
  if (typeof structuredClone === 'function') {
    return structuredClone(obj) as T;
  }
  // Fallback для старых окружений
  return JSON.parse(JSON.stringify(obj)) as T;
}
```
