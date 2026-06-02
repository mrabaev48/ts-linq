# @ts-linq/eslint-config

> Shared ESLint flat-config factory for the ts-linq monorepo.

Provides a single, reusable ESLint flat config so every package lints with the same rules
(TypeScript, import hygiene, type-safety rules). Consumed via each package's `eslint.config.*`.

## Installation

Internal workspace package — referenced by other packages, not published for external use.

## Usage

```js
// eslint.config.mjs in a package
import tsLinqConfig from '@ts-linq/eslint-config';
export default tsLinqConfig();
```

## Package structure

```
index.mjs   # flat-config factory (default export)
```

## Notes

- Exposes a factory (`index.mjs`) returning the flat-config array.
- Excluded from changesets/publishing.

## License

Part of the ts-linq monorepo. See the repository root for license details.
