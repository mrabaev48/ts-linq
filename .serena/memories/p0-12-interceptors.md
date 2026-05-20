# P0-12 — EF-style Interceptors

## Status: ✅ Implemented (PR pending merge)

## Public API Surface

### @ts-linq/core exports:
```typescript
export { InterceptionResult } from './interceptors/InterceptionResult';
export type { IDbCommandInterceptor } from './interceptors/IDbCommandInterceptor';
export type { IDbConnectionInterceptor } from './interceptors/IDbConnectionInterceptor';
export type { IDbTransactionInterceptor } from './interceptors/IDbTransactionInterceptor';
export type { IMaterializationInterceptor } from './interceptors/IMaterializationInterceptor';
export type { ISaveChangesInterceptor } from './interceptors/ISaveChangesInterceptor';
export type { CommandEventData, ConnectionEventData, DbCommand, DbReader,
  MaterializationInterceptionData, SaveChangesEntry, SaveChangesEventData,
  TransactionEventData } from './interceptors/types';
```

### @ts-linq/orm exports:
```typescript
export { DbContextOptionsBuilder } from './DbContextOptionsBuilder';
export { InterceptorRegistry } from './interceptors/InterceptorRegistry';
```

### DbContextOptions now has:
```typescript
interceptors?: object[];
```

## Usage Pattern
```typescript
const opts = new DbContextOptionsBuilder({ provider })
  .addInterceptors(new MyCommandLogger(), new MyAuditInterceptor())
  .build();
const ctx = new AppDbContext(opts);
```

## Interceptor Interface Signatures

### ISaveChangesInterceptor
```typescript
interface ISaveChangesInterceptor {
  savingChanges?(ev: SaveChangesEventData, result: InterceptionResult<number>): InterceptionResult<number> | void | Promise<...>;
  savedChanges?(ev: SaveChangesEventData, result: number): number | void | Promise<...>;
  saveChangesFailed?(ev: SaveChangesEventData, err: Error): void | Promise<void>;
}
```

### IDbCommandInterceptor
```typescript
interface IDbCommandInterceptor {
  readerExecuting?(cmd: DbCommand, result: InterceptionResult<DbReader>): InterceptionResult<DbReader> | void | Promise<...>;
  readerExecuted?(cmd: DbCommand, result: DbReader): DbReader | void | Promise<...>;
  nonQueryExecuting?(cmd: DbCommand, result: InterceptionResult<number>): InterceptionResult<number> | void | Promise<...>;
  nonQueryExecuted?(cmd: DbCommand, data: CommandEventData): void | Promise<void>;
}
```

## Architecture Notes

### Template Method Pattern in DatabaseProvider
- `connect()` → calls notifyConnectionOpening() → doConnect() → notifyConnectionOpened()
- `disconnect()` → calls notifyConnectionClosing() → doDisconnect() → notifyConnectionClosed()
- `beginTransaction()` → notifyTransactionStarting() → doBeginTransaction() → notifyTransactionStarted()
- `commitTransaction()` → notifyTransactionCommitting() → doCommitTransaction() → notifyTransactionCommitted()
- `rollbackTransaction()` → notifyTransactionRollingBack() → doRollbackTransaction() → notifyTransactionRolledBack()
- ALL provider subclasses must implement doConnect/doDisconnect/doBeginTransaction/doCommitTransaction/doRollbackTransaction (abstract)

### InterceptorRegistry
- Constructed once per DbContext from `options.interceptors`
- Duck-typing guards use `'methodName' in v` (works on prototype chain)
- `isEmpty` flag: O(1) fast-path when no interceptors registered
- Multi-interface interceptors appear in multiple partitions (same object reference)
- `forEachSaveChanges()`, `forEachCommand()`, `forEachConnection()`, `forEachTransaction()`, `forEachMaterialization()`

### saveChanges() Pipeline Order
1. savingChanges() for each ISaveChangesInterceptor (can suppress = skip DML entirely)
2. beginTransaction() (if not already in transaction)
3. DML: insert/update/delete per tracked change
4. commitTransaction()
5. savedChanges() for each ISaveChangesInterceptor (can adjust row count)
--- on error ---
6. rollbackTransaction()
7. saveChangesFailed() for each ISaveChangesInterceptor

### AuditInterceptor refactor
- now implements ISaveChangesInterceptor
- savingChanges() iterates entries and calls existing apply() per entry
- apply() method kept intact for backward compat

### SoftDeleteInterceptor refactor
- now implements ISaveChangesInterceptor
- savingChanges() is a pass-through; actual soft-delete logic stays in DeleteCommand

## Known Limitations
- IDbCommandInterceptor.readerExecuting/nonQueryExecuting can suppress execution (return SuppressWithResult) but the base DatabaseProvider only passes through NonResult to actual execution; suppression of the actual DB call is at the provider level, not fully wired for custom providers.
- IMaterializationInterceptor.initializing/initialized hooks exist but are only called in DatabaseProvider.notifyEntityMaterialized() which must be explicitly invoked by providers.
