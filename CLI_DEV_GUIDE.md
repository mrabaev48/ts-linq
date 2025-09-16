ts-linq CLI Dev Guide

Goals

- Keep code Clean and SOLID
- Follow Command pattern and DIP via ports/adapters

Create a new command

1. Create a file in `src/cli/commands/YourCommand.ts`:

```ts
import type { Command } from '../runtime/command';
import type { Flags } from '../runtime/types';

export class YourCommand implements Command {
  public async execute(rest: string[], flags: Flags): Promise<number> {
    // implement logic here
    return 0;
  }
}
```

2. Register it in `src/bin/ts-linq-cli.ts`:

```ts
import { YourCommand } from '../cli/commands/YourCommand';
// ...
registry.register('your', new YourCommand());
```

3. Update help in `printHelp()` accordingly.

Use ports (DIP)

- Prefer `FsPort`, `ProcessPort`, `ChecksumPort`, `CliLogger` instead of direct Node APIs
- If you need a new kind of I/O, add a new port interface and an adapter in `runtime/nodeAdapters.ts`

Testing

- Unit: mock ports; assert return codes and printed JSON
- E2E: spawn the CLI with `spawnSync` and a temp working dir

Coding standards

- No `any` in public surfaces
- Descriptive names (no one-letter variables)
- Guard clauses for early exits; small functions
