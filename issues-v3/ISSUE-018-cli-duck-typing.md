# ISSUE-018: CLI Uses Duck-Typing for `DbCommand` Dispatch

## Severity

Low

## Category

- Type System
- Maintainability
- Clean Code

## Location

- `packages/cli/src/cli.ts:61–67`

## Problem

The CLI dispatcher uses a runtime duck-type check to determine whether a command requires a database provider:

```typescript
// packages/cli/src/cli.ts
const maybeDb = command as DbCommand;
const isDbCommand = typeof maybeDb.runDb === 'function';

if (isDbCommand) {
  await maybeDb.runDb(provider, argv);
} else {
  await command.run(argv);
}
```

This pattern:
1. Casts `command` to `DbCommand` unconditionally before checking
2. Uses a `typeof ... === 'function'` runtime check instead of a type guard or discriminated union
3. Means the type system provides no guarantee about which commands require a provider at compile time

If a command accidentally implements `runDb` with the wrong signature, the check passes and the provider is incorrectly injected. If a command that needs a provider forgets to implement `runDb`, it silently falls through to `run(argv)` without a provider — no compile-time error.

## Evidence

```typescript
// packages/cli/src/cli.ts:61
const maybeDb = command as DbCommand;        // unconditional cast
const isDbCommand = typeof maybeDb.runDb === 'function'; // duck type
```

The `Command` and `DbCommand` interfaces almost certainly differ only in the presence of `runDb`. A discriminated union or type guard function would express this cleanly.

## Why It Matters

- **Type-safety risk**: The cast `command as DbCommand` is unsafe — any command will "pass" the cast. The duck-type check then re-establishes what the type already failed to guarantee.
- **Maintainability**: Adding a new command that requires a provider requires knowing to implement `runDb` — there is no interface forcing this. Forgetting results in a silent runtime failure rather than a build error.
- **Clean Code**: Two lines to do what a discriminated union + type guard does in one.

## Recommended Fix

Use a proper type guard:

```typescript
// packages/cli/src/CommandRegistry.ts or cli.ts
function isDbCommand(cmd: Command): cmd is DbCommand {
  return 'runDb' in cmd && typeof (cmd as DbCommand).runDb === 'function';
}

// Then in dispatch:
if (isDbCommand(command)) {
  await command.runDb(provider, argv);
} else {
  await command.run(argv);
}
```

Or use a discriminated union:

```typescript
type AnyCommand =
  | { kind: 'simple'; run(argv: string[]): Promise<void> }
  | { kind: 'db'; runDb(provider: DatabaseProvider, argv: string[]): Promise<void> };
```

The type guard approach is least disruptive to existing command implementations.

## Acceptance Criteria

- No `as DbCommand` cast before a duck-type check in `cli.ts`
- A typed `isDbCommand()` type guard function exists and is used for dispatch
- Adding a new command that needs a provider causes a compile error if `runDb` is missing (via the interface)
- The dispatch logic in `cli.ts` compiles without unsafe casts
