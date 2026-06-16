# @ts-linq/open-telemetry-sql-logger

## 12.0.5

### Patch Changes

- Extract a single shared `maskSql(sql, patterns?)` SQL-literal redaction utility into
  `@ts-linq/types` (alongside the other pure runtime helpers) and have all three
  `SqlLogger` implementations delegate to it.

  Previously the same security-sensitive redaction (two literal regexes plus a custom
  `maskPatterns` loop with per-pattern `try/catch`) was copy-pasted into
  `TelemetryProvider.mask`, `OpenTelemetrySqlLogger.mask`, and
  `PrometheusSqlLogger.maskIfNeeded`, so a hardening fixed in one logger silently left
  the other two leaking literals. The masked output is byte-identical to the previous
  behaviour; this is a pure de-duplication onto one tested unit.

- Updated dependencies
  - @ts-linq/types@4.7.0
  - @ts-linq/core@3.4.5

## 12.0.4

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.6.0
  - @ts-linq/core@3.4.4

## 12.0.3

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.5.0
  - @ts-linq/core@3.4.3

## 12.0.2

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.4.0
  - @ts-linq/core@3.4.2

## 12.0.1

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.3.0
  - @ts-linq/core@3.4.1

## 12.0.0

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.4.0

## 11.0.0

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.3.0

## 10.0.0

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.2.0

## 9.0.0

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.1.0

## 8.0.10

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.2.0
  - @ts-linq/core@3.0.10

## 8.0.9

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.0.9

## 8.0.8

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.0.8

## 8.0.7

### Patch Changes

- Updated dependencies [416a1a6]
  - @ts-linq/types@4.1.0
  - @ts-linq/core@3.0.7

## 8.0.6

### Patch Changes

- @ts-linq/core@3.0.6

## 8.0.5

### Patch Changes

- Updated dependencies [5aa6196]
  - @ts-linq/core@3.0.5

## 8.0.4

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@3.0.4

## 8.0.3

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@3.0.3

## 8.0.2

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@3.0.2

## 8.0.1

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@3.0.1

## 8.0.0

### Patch Changes

- Updated dependencies [[`6c1d403`](https://github.com/mrabaev48/ts-linq/commit/6c1d403078729a825c39af05bf4dc6ea8c9df644)]:
  - @ts-linq/types@4.0.0
  - @ts-linq/core@3.0.0

## 7.0.6

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@2.0.6

## 7.0.5

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@2.0.5

## 7.0.4

### Patch Changes

- Updated dependencies [[`40a71ed`](https://github.com/mrabaev48/ts-linq/commit/40a71ed3079bdf86492e9f27a226470a3985f39e)]:
  - @ts-linq/types@3.1.0
  - @ts-linq/core@2.0.4

## 7.0.3

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@2.0.3

## 7.0.2

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@2.0.2

## 7.0.1

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@2.0.1

## 7.0.0

### Patch Changes

- Updated dependencies [[`5995782`](https://github.com/mrabaev48/ts-linq/commit/5995782a9f1c7449d7ad457a8cf1700cd80b9c0d)]:
  - @ts-linq/types@3.0.0
  - @ts-linq/core@2.0.0

## 6.0.3

### Patch Changes

- Updated dependencies [[`fcc484a`](https://github.com/mrabaev48/ts-linq/commit/fcc484a7e9c13f53c30a9e9beac62baf7c616f85)]:
  - @ts-linq/types@2.12.1
  - @ts-linq/core@1.5.3

## 6.0.2

### Patch Changes

- Updated dependencies [[`288f77d`](https://github.com/mrabaev48/ts-linq/commit/288f77d2a8027e912e60edfe6b9e171d6c9f548f)]:
  - @ts-linq/types@2.12.0
  - @ts-linq/core@1.5.2

## 6.0.1

### Patch Changes

- Updated dependencies [[`2df83e5`](https://github.com/mrabaev48/ts-linq/commit/2df83e5c5c49a1c4be98748905fdf2d9511b4d56)]:
  - @ts-linq/types@2.11.1
  - @ts-linq/core@1.5.1

## 6.0.0

### Patch Changes

- Updated dependencies [[`6304976`](https://github.com/mrabaev48/ts-linq/commit/6304976b1ad6aeaf3db8f9fc2182b89f766340c6)]:
  - @ts-linq/types@2.11.0
  - @ts-linq/core@1.5.0

## 5.0.8

### Patch Changes

- Updated dependencies [[`f03dbf1`](https://github.com/mrabaev48/ts-linq/commit/f03dbf1d4c9ee5f10faf70a3d87babc638918508)]:
  - @ts-linq/types@2.10.0
  - @ts-linq/core@1.4.8

## 5.0.7

### Patch Changes

- Updated dependencies [[`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252)]:
  - @ts-linq/core@1.4.7
  - @ts-linq/types@2.9.0

## 5.0.6

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@1.4.6

## 5.0.5

### Patch Changes

- Updated dependencies [[`9c2ad23`](https://github.com/mrabaev48/ts-linq/commit/9c2ad23d0a2f934f881524e280e76329f4d1eed0)]:
  - @ts-linq/types@2.8.0
  - @ts-linq/core@1.4.5

## 5.0.4

### Patch Changes

- Updated dependencies [[`1dd26bb`](https://github.com/mrabaev48/ts-linq/commit/1dd26bbb55d4e7ca1e522a5e763c4893ea3dde54)]:
  - @ts-linq/types@2.7.0
  - @ts-linq/core@1.4.4

## 5.0.3

### Patch Changes

- Updated dependencies [[`1a0d098`](https://github.com/mrabaev48/ts-linq/commit/1a0d098baa3e18f406eafae8281ee7daf442cdea)]:
  - @ts-linq/types@2.6.0
  - @ts-linq/core@1.4.3

## 5.0.2

### Patch Changes

- Updated dependencies [[`4c6abea`](https://github.com/mrabaev48/ts-linq/commit/4c6abead6c23c96d3faa01c4f12368f92ed935f5)]:
  - @ts-linq/types@2.5.0
  - @ts-linq/core@1.4.2

## 5.0.1

### Patch Changes

- Updated dependencies [[`2f86a0d`](https://github.com/mrabaev48/ts-linq/commit/2f86a0d8b0487673603aa6816997ed394e9d91e7), [`2aa9392`](https://github.com/mrabaev48/ts-linq/commit/2aa939259c682cad252f89818db47909e1af16f8), [`69ecc17`](https://github.com/mrabaev48/ts-linq/commit/69ecc171e11a03f46c02533dc2b13351f5cd16a3), [`5284cc5`](https://github.com/mrabaev48/ts-linq/commit/5284cc519fe8c5c6486b35c6d88a00e114317a7b), [`66043bb`](https://github.com/mrabaev48/ts-linq/commit/66043bb78642b837464d20a8040660af69e61795), [`03caeac`](https://github.com/mrabaev48/ts-linq/commit/03caeac9ea0c29aca70922b0c349aae30dc3d907)]:
  - @ts-linq/types@2.4.0
  - @ts-linq/core@1.4.1

## 5.0.0

### Patch Changes

- Updated dependencies [51516f8]
- Updated dependencies [cd77e1f]
- Updated dependencies [7745012]
- Updated dependencies [90402db]
- Updated dependencies [240059c]
- Updated dependencies [2f86a0d]
- Updated dependencies [b738384]
- Updated dependencies [6cad9cf]
- Updated dependencies [d0668cb]
  - @ts-linq/types@2.3.0
  - @ts-linq/core@1.4.0

## 4.0.0

### Patch Changes

- Updated dependencies [[`11583da`](https://github.com/mrabaev48/ts-linq/commit/11583daee8abd16f5e0a21bd72eecd396d94789c)]:
  - @ts-linq/core@1.3.0
  - @ts-linq/types@2.2.0

## 3.0.0

### Patch Changes

- Updated dependencies [[`6e83ca9`](https://github.com/mrabaev48/ts-linq/commit/6e83ca9ce576f309f0959b10cd0b43566012f4fb), [`1c2b714`](https://github.com/mrabaev48/ts-linq/commit/1c2b714b8b72a0a15fc94c11c1be40dc12597a9a)]:
  - @ts-linq/core@1.2.0
  - @ts-linq/types@2.1.0

## 2.0.0

### Patch Changes

- Updated dependencies [[`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d)]:
  - @ts-linq/core@1.1.0
  - @ts-linq/types@2.0.0
