# @ts-linq/jest-config

> Shared Jest configuration for the ts-linq monorepo.

Provides a common Jest config (and a TS transformer) so every package runs tests with consistent
settings, module resolution, and the ts-linq transformer applied.

## Usage

```js
// jest.config.js in a package
module.exports = require('@ts-linq/jest-config');
```

## Package structure

```
index.js              # shared Jest config
jest-transformer.js   # TS/transformer setup for tests
```

## Notes

- Internal workspace package; excluded from changesets/publishing.
- Owns the module-name mappings that point `@ts-linq/*` imports at source during tests.

## License

Part of the ts-linq monorepo. See the repository root for license details.
