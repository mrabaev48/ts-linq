# Issue #08 — ChangeTracker: Идентификация по Ссылке и JSON-Клонирование

**Severity:** High  
**Category:** Correctness / Performance  
**Affected files:**
- `packages/core/src/change-tracking/ChangeTracker.ts`

---

## Описание проблемы

`ChangeTracker` использует `Map<object, TrackedEntity>` с ключом — ссылкой на объект, и `JSON.parse(JSON.stringify(obj))` для глубокого клонирования при сохранении `originalValues`.

```ts
export class ChangeTracker {
  private _trackedEntities: Map<object, TrackedEntity> = new Map();

  private cloneObject<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  private areObjectsEqual<T>(obj1: T, obj2: T): boolean {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }
}
```

---

## Технические сложности

### 1. Отсутствие деупликации по первичному ключу

Если один и тот же entity загружен дважды (два разных HTTP-запроса, два `find()` вызова), создаётся два **разных JavaScript объекта** с одинаковыми данными. `ChangeTracker` хранит оба независимо, потому что ключ — это ссылка на объект, а не значение PK.

```ts
const user1 = await ctx.users.find(1); // объект A
const user2 = await ctx.users.find(1); // объект B (другой экземпляр!)

user1.name = 'Alice';
ctx.users.update(user1);

user2.name = 'Bob';
ctx.users.update(user2);

await ctx.saveChanges();
// Что будет? Два UPDATE с id=1, имя запишется 'Bob' (последний выиграл)
// Никакого предупреждения. ChangeTracker не знает, что это та же запись.
```

EF Core решает это через Identity Map: первый `Find(1)` кэшируется, второй `Find(1)` возвращает тот же объект.

### 2. `JSON.parse(JSON.stringify())` — неправильное клонирование

Этот подход ломается для:

```ts
// Date теряет тип:
const user = new User();
user.createdAt = new Date('2024-01-01');
// После JSON round-trip:
const cloned = JSON.parse(JSON.stringify(user));
cloned.createdAt // → строка "2024-01-01T00:00:00.000Z", не Date!

// Undefined становится null или пропадает:
user.middleName = undefined;
cloned.middleName // → отсутствует в объекте

// Circular references:
user.self = user;
JSON.stringify(user) // → TypeError: Converting circular structure to JSON

// BigInt:
user.id = 9007199254740993n;
JSON.stringify(user) // → TypeError: Do not know how to serialize a BigInt

// Buffer/Uint8Array:
user.avatar = Buffer.from([1, 2, 3]);
// После round-trip → { type: 'Buffer', data: [1, 2, 3] } — не Buffer!
```

### 3. `detectChanges()` через `JSON.stringify` — O(n) по размеру объекта

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

private areObjectsEqual<T>(obj1: T, obj2: T): boolean {
  return JSON.stringify(obj1) === JSON.stringify(obj2); // ← O(n) всегда
}
```

Для каждого отслеживаемого объекта при каждом вызове `detectChanges()` создаётся полная JSON-строка. При 10 000 отслеживаемых объектов с полем blob или JSON-column это может создать значительное давление на GC.

Кроме того, `JSON.stringify` не гарантирует стабильный порядок ключей в объектах, что может давать ложные positives при изменении порядка свойств (хотя на практике V8 сохраняет порядок вставки).

### 4. `detectChanges()` никогда не вызывается автоматически

```ts
// detectChanges() существует, но не вызывается в saveChanges():
public async saveChanges(): Promise<number> {
  const changes = this._changeTracker.getChanges();
  // ← нет вызова detectChanges() здесь!
  ...
}
```

Это означает, что если пользователь загрузил сущность, изменил её поля напрямую (без `update()`), но не вызвал `ctx.users.update(entity)`, изменения **не будут сохранены**:

```ts
const user = await ctx.users.find(1);
user.name = 'Alice'; // ← изменение
await ctx.saveChanges(); // ← 0 affected rows! detectChanges не вызывался
```

В EF Core `detectChanges()` вызывается автоматически перед `SaveChanges()`.

### 5. `attach()` не проверяет дублирование

```ts
public attach<T extends object>(entity: T, entityClass: Function): void {
  this._trackedEntities.set(entity, {
    entity,
    entityClass,
    state: EntityState.Unchanged,
    originalValues: this.cloneObject(entity)
  });
}
```

Если один и тот же объект `attach()`-ить дважды с разным `entityClass` — второй вызов тихо перезапишет первый. Нет проверки.

---

## Предлагаемое решение

### Шаг 1: Identity Map — дедупликация по первичному ключу

```ts
export class ChangeTracker {
  // Основной хранилище по PK-значению
  private _identityMap: Map<string, TrackedEntity> = new Map();
  // Слабая ссылка для быстрого lookup по объекту
  private _objectIndex: WeakMap<object, string> = new WeakMap();

  private buildIdentityKey(entityClass: Function, pkValue: unknown): string {
    return `${entityClass.name}|${String(pkValue)}`;
  }

  public attach<T extends object>(entity: T, entityClass: Function, pkValue: unknown): void {
    const key = this.buildIdentityKey(entityClass, pkValue);
    
    if (this._identityMap.has(key)) {
      // Возвращаем уже отслеживаемый объект — Identity Map!
      return;
    }
    
    const tracked: TrackedEntity = {
      entity,
      entityClass,
      state: EntityState.Unchanged,
      originalValues: this.cloneObject(entity)
    };
    this._identityMap.set(key, tracked);
    this._objectIndex.set(entity, key);
  }

  public getTrackedByPk<T extends object>(entityClass: Function, pkValue: unknown): T | null {
    const key = this.buildIdentityKey(entityClass, pkValue);
    return (this._identityMap.get(key)?.entity as T) ?? null;
  }
}
```

### Шаг 2: Структурное клонирование вместо JSON round-trip

```ts
private cloneObject<T>(obj: T): T {
  // Node.js 17+: structuredClone поддерживает Date, Map, Set, ArrayBuffer, ...
  if (typeof structuredClone !== 'undefined') {
    try {
      return structuredClone(obj);
    } catch {
      // Fallback для неклонируемых объектов (functions, WeakMap, ...)
    }
  }
  // Базовый fallback
  return JSON.parse(JSON.stringify(obj));
}
```

### Шаг 3: Снапшот только column-значений для `detectChanges`

Вместо клонирования всего объекта хранить только маппинг column -> value:

```ts
interface ColumnSnapshot {
  [columnName: string]: unknown;
}

private takeColumnSnapshot(entity: object, entityClass: Function): ColumnSnapshot {
  const meta = MetadataStorage.getEntity(entityClass);
  if (!meta) return {};
  
  const snapshot: ColumnSnapshot = {};
  for (const col of meta.columns) {
    snapshot[col.propertyName] = (entity as Record<string, unknown>)[col.propertyName];
  }
  return snapshot;
}

private detectColumnChanges(entity: object, snapshot: ColumnSnapshot): string[] {
  const changed: string[] = [];
  for (const [prop, originalValue] of Object.entries(snapshot)) {
    const currentValue = (entity as Record<string, unknown>)[prop];
    if (!this.valuesEqual(currentValue, originalValue)) {
      changed.push(prop);
    }
  }
  return changed;
}

private valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  return false; // Для объектов — считаем изменёнными (консервативно)
}
```

### Шаг 4: Автоматический `detectChanges()` перед `saveChanges()`

```ts
public async saveChanges(): Promise<number> {
  this._changeTracker.detectChanges(); // ← добавить
  const changes = this._changeTracker.getChanges();
  ...
}
```
