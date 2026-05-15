# Suggested Commands

## Build
```bash
pnpm build                        # build all packages
pnpm build:<package>              # build specific package (e.g. pnpm build:core)
pnpm turbo run build              # alias
```

## Test
```bash
pnpm test                         # run all unit tests (jest)
pnpm test:unit                    # unit tests only (jest.unit.config.js)
pnpm test:integration             # integration tests (testcontainers)
pnpm test:e2e                     # end-to-end tests
pnpm test:watch                   # watch mode
pnpm test:coverage                # with coverage
```

## Lint / Format
```bash
pnpm lint                         # eslint --fix
pnpm format                       # prettier --write .
pnpm format:check                 # prettier --check .
```

## Type checking
```bash
pnpm typecheck                    # turbo run typecheck (all packages)
```

## Architecture analysis
```bash
pnpm arch:deps                    # dependency-cruiser check
pnpm arch:deps:json               # output to reports/dependency-cruiser.json
pnpm arch:deps:dot                # output dot graph
pnpm arch:deps:graph              # render SVG graph
pnpm arch:cycles                  # madge circular dependency check
pnpm arch:graph                   # madge SVG graph
pnpm arch:dead                    # ts-prune dead code check
pnpm arch:audit                   # typecheck + deps + cycles + dead
```

## Examples
```bash
pnpm example:postgres
pnpm example:mysql
pnpm example:mssql
pnpm example:simple
pnpm example:advanced
pnpm example:basic
pnpm example:migrations
```

## Other
```bash
pnpm docs                         # generate TypeDoc docs
pnpm clean                        # clean all dist dirs
pnpm ts-patch:install             # install ts-patch for transformer
```

## System utilities (Darwin/macOS)
```bash
ls, find, grep, git, cd, cat, open
```
