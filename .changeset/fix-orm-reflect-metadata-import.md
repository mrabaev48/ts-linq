---
"@ts-linq/orm": patch
---

fix(orm): add missing `import 'reflect-metadata'` in ModelBuilder

`ModelBuilder.safeGetDesignType()` calls `Reflect.getMetadata()` which is
type-augmented by `reflect-metadata`. Without an explicit import the
TypeScript compiler (ts-jest) cannot find the method declaration and emits
`TS2339: Property 'getMetadata' does not exist on type 'typeof Reflect'`,
causing `ModelBuilder.test.ts` to fail intermittently depending on module
load order in the Jest runner.
