# Issue #03 — `saveChanges()` Не Атомарен: Отсутствует Обёртка в Транзакцию

**Severity:** Critical  
**Category:** Data Integrity / Correctness  
**Affected files:**
- `packages/core/src/context/DbContext.ts` (метод `saveChanges`)
- `packages/core/src/context/commands/InsertCommand.ts`
- `packages/core/src/context/commands/UpdateCommand.ts`
- `packages/core/src/context/commands/DeleteCommand.ts`

---

## Описание проблемы

Метод `saveChanges()` обрабатывает изменения последовательно в цикле, **без явной транзакции**:

```ts
public async saveChanges(): Promise<number> {
  const changes = this._changeTracker.getChanges();
  // ...валидация...
  let affectedRows = 0;
  for (const change of changes) {      // ← последовательный цикл
    const normalized = this.normalizeChange(change);
    this.applyAudit(normalized);
    affectedRows += await this.processChange(normalized); // ← каждый запрос отдельно
  }
  // ...инвалидация кэша...
  this._changeTracker.acceptAllChanges();
  return affectedRows;
}
```

Если в момент обработки, например, третьего из пяти изменений произойдёт ошибка (сетевой сбой, нарушение ограничения FK, дедлок), первые два изменения уже записаны в БД, а три оставшихся — нет. База оказывается в **несогласованном состоянии**.

---

## Технические сложности

### 1. Частичное сохранение приводит к потере целостности данных

Пример: пользователь переводит деньги между счетами.

```ts
ctx.accounts.update(sourceAccount);   // -1000 ₽
ctx.accounts.update(targetAccount);   // +1000 ₽
ctx.transactions.add(transactionLog); // запись в лог

await ctx.saveChanges();
// Если третья операция упала — в базе деньги ушли, но не пришли
```

Это недопустимо в любой финансовой или бизнес-критической системе.

### 2. `ChangeTracker.acceptAllChanges()` вызывается даже при частичном успехе

```ts
for (const change of changes) {
  affectedRows += await this.processChange(normalized); // ← может упасть здесь
}
// Если упало выше — мы сюда не попадём, но первые изменения уже в БД
// Если не упало — acceptAllChanges() помечает всё как сохранённое
this._changeTracker.acceptAllChanges();
```

После ошибки `ChangeTracker` остаётся в состоянии с несохранёнными изменениями, но база уже частично обновлена. Повторный вызов `saveChanges()` может привести к дублированию.

### 3. Cascade-операции усугубляют проблему

Если сущность настроена с `cascade: true`, вставка родителя автоматически вставляет дочерние записи. Если вставка дочерней записи упала после успешной вставки родителя — FK-связи нарушены.

### 4. Отсутствует защита от concurrent writes

Два одновременных вызова `saveChanges()` (например, два HTTP-запроса) могут обрабатывать пересекающиеся наборы изменений. Без транзакции нет гарантии сериализации.

### 5. Явная транзакция пользователя не защищает от этого

Пользователь может написать:

```ts
await ctx.beginTransaction();
await ctx.saveChanges();
await ctx.commitTransaction();
```

Но это работает только если явно обернуть каждый вызов. `saveChanges()` сам по себе не использует транзакцию, и это нарушает принцип наименьшего удивления — EF Core всегда оборачивает в транзакцию.

---

## Предлагаемое решение

### Шаг 1: `saveChanges()` всегда работает в транзакции

```ts
public async saveChanges(): Promise<number> {
  const changes = this._changeTracker.getChanges();
  if (!changes || changes.length === 0) return 0;

  this.prefillDefaults(changes);
  const normalized = this.normalizeForValidation(changes);
  this._validationService.validate(normalized);

  // Если уже в транзакции (пользователь открыл вручную) — не создаём вложенную
  const ownsTransaction = !this._provider.inTransactionState;
  
  if (ownsTransaction) {
    await this._provider.beginTransaction();
  }

  try {
    let affectedRows = 0;
    for (const change of normalized) {
      this.applyAudit(change);
      affectedRows += await this.processChange(change);
    }

    if (ownsTransaction) {
      await this._provider.commitTransaction();
    }

    this.invalidateCachesAfterSave(normalized);
    this._changeTracker.acceptAllChanges();
    return affectedRows;

  } catch (error) {
    if (ownsTransaction) {
      await this._provider.rollbackTransaction();
    }
    // НЕ вызываем acceptAllChanges — изменения остаются в трекере
    throw error;
  }
}
```

### Шаг 2: Добавить публичное свойство `inTransactionState` в `DatabaseProvider`

```ts
// DatabaseProvider (abstract)
public get inTransactionState(): boolean {
  return this.inTransaction;
}
```

Это свойство уже используется в `BatchExecutor`, но объявлено только там через прямое обращение к `provider.inTransactionState`.

### Шаг 3: Savepoints для вложенных транзакций (опционально)

Для провайдеров, поддерживающих SAVEPOINT (PostgreSQL, MySQL), можно добавить поддержку вложенных транзакций:

```ts
if (ownsTransaction) {
  await this._provider.beginTransaction();
} else {
  await this._provider.createSavepoint('saveChanges_savepoint');
}

// При ошибке:
if (ownsTransaction) {
  await this._provider.rollbackTransaction();
} else {
  await this._provider.rollbackToSavepoint('saveChanges_savepoint');
}
```

---

## Совместимость

Изменение обратно совместимо: пользователи, которые уже вручную открывают транзакцию перед `saveChanges()`, продолжат работать корректно (будет использована их транзакция). Пользователи без явной транзакции получат автоматическую — что является правильным поведением по умолчанию.

---

## Ссылка на аналог в EF Core

В Entity Framework Core метод `SaveChanges()` всегда оборачивает изменения в транзакцию, если пользователь сам не открыл одну:
> "By default, if the database provider supports transactions, all changes in a single call to SaveChanges are applied in a transaction."  
> — https://learn.microsoft.com/en-us/ef/core/saving/transactions
