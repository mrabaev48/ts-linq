# Issue #11 — `DbSet._entityClass` Публичное Поле

**Severity:** Medium  
**Status:** Остаётся (перемещён в `@ts-linq/orm`)  
**Affected files:**
- `packages/orm/src/DbSet.ts` (строка 18)
- `packages/orm/src/DbContext.ts` (строка 184)

---

## Описание проблемы

```ts
// packages/orm/src/DbSet.ts:18
export class DbSet<T extends object> {
  public _entityClass: new () => T;  // ← public, с подчёркиванием!
```

```ts
// packages/orm/src/DbContext.ts:184
const dbSet = this._dbSets.get(normalized) as unknown as DbSet<T>;
// Ensure the DbSet reflects the exact (possibly decorated) class passed in
dbSet._entityClass = entityClass;  // ← внешняя мутация публичного поля
```

Конвенция подчёркивания `_` означает "приватное", но TypeScript считает поле публичным.
Внешний код (DbContext) напрямую мутирует внутреннее состояние DbSet.

## Последствия

1. **Нарушение инкапсуляции**: любой внешний код может изменить `_entityClass`:
   ```ts
   ctx.users._entityClass = Product; // продукт будет вставляться в таблицу users!
   ```

2. **Нарушение контракта**: тип `DbSet<User>` теперь не гарантирует, что хранит `User`.

## Предлагаемое решение

```ts
export class DbSet<T extends object> {
  private _entityClass: new () => T;
  
  // Для DbContext — внутренний метод или factory
  /** @internal */ 
  public _setEntityClass(cls: new () => T): void {
    this._entityClass = cls;
  }
}
```

Или лучше — решить корневую причину: DbContext не должен менять `_entityClass` после создания.
Если нужна поддержка декорированных классов — передавать правильный класс при создании DbSet.
