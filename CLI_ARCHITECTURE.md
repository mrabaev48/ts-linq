ts-linq CLI Architecture

Overview
The CLI follows Clean Code and SOLID principles. It is structured around the Command pattern with a simple runtime layer and explicit Ports/Adapters for environment access.

Key Components
- Entry point: `src/bin/ts-linq-cli.ts`
  - Parses args (via runtime), builds `CommandRegistry`, delegates execution
  - Centralized error handling and exit codes
- Runtime (`src/cli/runtime/*`)
  - `args.ts`: parse flags and positional args
  - `config.ts`: resolve effective configuration (flags > env > config file > defaults)
  - `bootstrap.ts`: load bootstrap files and entities (globs)
  - `registry.ts`: `CommandRegistry` that maps names to `Command`
  - `ports.ts`: `FsPort`, `ProcessPort`, `ChecksumPort`, `CliLogger`
  - `nodeAdapters.ts`: Node.js adapters for ports
- Commands (`src/cli/commands/*`)
  - One class per command implementing `Command` interface
  - Dependencies come from runtime ports (DIP) and domain services

Error and Exit Code Policy
- 0: success
- 1: internal/runtime/SQL error
- 2: invalid input/validation/unknown command
- 3: drift detected (`verify`)

Data Flow
1) `ts-linq-cli.ts` reads argv → `parseArgs`
2) Build registry → get command by name
3) Execute command with `(rest, flags, context)`
4) Command uses ports and domain services to perform work
5) Result printed in text or JSON format

Testing Strategy
- Unit tests for runtime (args/config/bootstrap/registry) and port adapters
- E2E tests per command using `spawnSync` and isolated temp dirs

Adding new adapters
- Implement the corresponding `*Port` interface
- Provide a wire-up in the entry point or the command that needs it

