# ISSUE-018: saveChanges() Opens a Transaction Without Checking for an Active One

## Severity

Medium

## Category

- Maintainability
- Testability

## Location

- `packages/orm/src/DbContext.ts:237-273` (saveChanges)
- `packages/orm/src/DbContext.ts:287-288` (public beginTransaction)

## Problem

`DbContext.saveChanges()` unconditionally calls `this._provider.beginTransaction()` at line 256 before processing changes. `DbContext` also exposes a public `beginTransaction()` method at line 287 that callers can invoke directly.

This creates a re-entrancy problem: if a caller opens a transaction manually (`await ctx.beginTransaction()`), then calls `await ctx.saveChanges()`, the `saveChanges()` will attempt to begin a nested transaction. The behavior is then entirely provider-dependent:

- **PostgreSQL**: `BEGIN` inside an active transaction triggers `WARNING: there is already a transaction in progress`.
- **MySQL**: `START TRANSACTION` in an active transaction implicitly commits the outer transaction first — a silent data hazard.
- **MSSQL**: Nested `BEGIN TRAN` increments `@@TRANCOUNT`, which changes commit/rollback semantics.

There is no documented contract specifying what `saveChanges()` does when a transaction is already active, and no guard in `DbContext` to detect this state.

## Evidence

`packages/orm/src/DbContext.ts:256`:
```ts
await this._provider.beginTransaction();
```
This call is unconditional; no `_inTransaction` flag or active transaction check precedes it.

`packages/orm/src/DbContext.ts:287-288`:
```ts
public async beginTransaction(): Promise<void> {
  await this._provider.beginTransaction();
}
```
Both `saveChanges()` and the public `beginTransaction()` call the provider directly without coordination.

## Why It Matters

- **Data integrity**: MySQL's implicit commit on nested `START TRANSACTION` can silently commit partial changes, violating atomicity guarantees.
- **Predictability**: Behavior differs per database provider, making cross-provider code unsafe unless the developer explicitly knows each driver's semantics.
- **Undocumented contract**: Neither `saveChanges()` nor `beginTransaction()` documents the behavior when called in the context of an active transaction.
- **Testing**: Integration tests that wrap test bodies in transactions (a common pattern for test isolation) may break silently when calling `saveChanges()`.

## Recommended Fix

1. Track transaction state in `DbContext`:
   ```ts
   private _transactionDepth = 0;
   ```
2. In `saveChanges()`: check `_transactionDepth > 0` and skip `beginTransaction()` if already in a transaction (use the caller's transaction).
3. In `beginTransaction()` / `commitTransaction()` / `rollbackTransaction()`: increment/decrement `_transactionDepth`.
4. Document the savepoint behavior for nested transactions (if supported) or throw a clear error if nesting is not supported.

## Acceptance Criteria

- `saveChanges()` does not call `beginTransaction()` when the context already has an active transaction.
- `DbContext` tracks transaction depth and exposes `get isInTransaction(): boolean`.
- API documentation for `saveChanges()` describes behavior in the presence of an active transaction.
- Integration test covers: `beginTransaction()` → multiple `saveChanges()` → `commitTransaction()` as a single atomic unit.
