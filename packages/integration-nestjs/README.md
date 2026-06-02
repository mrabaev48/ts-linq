# @ts-linq/integration-nestjs

> NestJS framework integration for ts-linq.

Intended to provide NestJS module/provider wiring so a ts-linq `DbContext` can be injected through
NestJS's DI container.

> **⚠️ Status: placeholder.** This package is currently a stub (`src/index.ts` only) with no
> implementation and no declared dependencies (not even NestJS or `@ts-linq/orm`). It is pre-`1.0`
> (`2.0.0-alpha.1`) and not usable yet. See `CLAUDE.md`.

## Intended scope (not yet implemented)

- A `DbContextModule` for registering contexts with NestJS DI.
- Request-scoped context / unit-of-work integration.
- Lifecycle hooks for connection management.

## Package structure

```
src/
  index.ts   # placeholder
```

## License

Part of the ts-linq monorepo. See the repository root for license details.
