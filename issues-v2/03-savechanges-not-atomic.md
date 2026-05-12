# Issue #03 — saveChanges() не атомарен

**Severity:** Critical  
**Status:** Остаётся  
**Affected files:**
- `packages/orm/src/DbContext.ts` (метод `saveChanges`, строки 221–248)

---

## Описание проблемы

`saveChanges()` перебирает изменения в цикле без транзакции:

```ts
// packages/orm/src/DbContext.ts:221-248
public async saveChanges(): Promise<number> {
  const changes = this._changeTracker.getChanges();
  if (!changes || changes.length === 0) return 0;
  this.prefillDefaults(changes);
  const normalizedForValidation = this.normalizeForValidation(changes);
  this._validationService.validate(normalizedForValidation as ...);
  
  let affectedRows = 0;
  for (const change of changes) {            // ← нет BEGIN TRANSACTION
    const normalized = this.normalizeChange(change);
    this.applyAudit(normalized);
    affectedRows += await this.processChange(normalized);  // INSERT/UPDATE/DELETE
  }
  // Если здесь выбросится исключение — часть изменений уже применена
  this.invalidateCachesAfterSave(normalizedForInvalidation);
  this._changeTracker.acceptAllChanges();
  return affectedRows;
}
```

Методы `beginTransaction()`, `commitTransaction()`, `rollbackTransaction()` **существуют**, но
не вызываются внутри `saveChanges()` автоматически.

## Технические сложности

### 1. Partial commit разрушает данные

```
User A (insert) → OK
User B (insert) → OK  
Order (insert)  → FAILS (FK violation)

Результат: Users созданы, Order — нет. Связанность нарушена.
```

### 2. Пользователь должен оборачивать saveChanges() вручную

```ts
await ctx.beginTransaction();
try {
  await ctx.saveChanges();
  await ctx.commitTransaction();
} catch (e) {
  await ctx.rollbackTransaction();
  throw e;
}
```

Это неявное требование нигде не задокументировано и нарушает принцип наименьшего удивления.
EF Core, Hibernate, TypeORM — все автоматически оборачивают saveChanges в транзакцию.

### 3. cache invalidation после partial commit

`invalidateCachesAfterSave()` вызывается ПОСЛЕ цикла. Если цикл упал на 5-м из 10 изменений,
первые 4 уже применены, но кэш не инвалидирован — читатели видят устаревшие данные.

## Предлагаемое решение

```ts
public async saveChanges(): Promise<number> {
  const changes = this._changeTracker.getChanges();
  if (!changes || changes.length === 0) return 0;
  
  this.prefillDefaults(changes);
  const normalized = this.normalizeForValidation(changes);
  this._validationService.validate(normalized as ...);
  
  await this._provider.beginTransaction();
  try {
    let affectedRows = 0;
    for (const change of changes) {
      const c = this.normalizeChange(change);
      this.applyAudit(c);
      affectedRows += await this.processChange(c);
    }
    await this._provider.commitTransaction();
    this.invalidateCachesAfterSave(normalized.map(c => ({ entity: c.entity, entityClass: c.entityClass, state: c.state })));
    this._changeTracker.acceptAllChanges();
    return affectedRows;
  } catch (error) {
    await this._provider.rollbackTransaction();
    throw error;
  }
}
```
