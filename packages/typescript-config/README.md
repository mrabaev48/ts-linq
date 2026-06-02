# @ts-linq/typescript-config

> Shared TypeScript compiler configs for the ts-linq monorepo.

Provides base `tsconfig` files that packages extend, so compiler options (strictness, module/target,
emit) stay consistent across the workspace.

## Provided configs

| File | Use |
|---|---|
| `base.json` | Base options every package extends |
| `node.json` | Node-targeted overrides (CJS-ish runtime) |
| `esm.json` | ESM build overrides |

## Usage

```jsonc
// tsconfig.json in a package
{ "extends": "@ts-linq/typescript-config/base.json" }
```

## Notes

- Internal workspace package; excluded from changesets/publishing.

## License

Part of the ts-linq monorepo. See the repository root for license details.
