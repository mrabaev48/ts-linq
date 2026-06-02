# @ts-linq/telemetry

> OpenTelemetry integration, diagnostic event emission, parameter masking, and warning routing for
> ts-linq.

This package centralizes how the ORM emits diagnostics: it defines event IDs, emits diagnostic
events, masks sensitive SQL parameters, maps query tags to span attributes, and routes warnings.

## Installation

```bash
pnpm add @ts-linq/telemetry
```

## What lives here

- **`TelemetryProvider`** (`provider/TelemetryProvider.ts`) — the integration surface.
- **Diagnostics** — `diagnostic-emitter.ts`, `event-ids.ts`.
- **Parameter masking** — `parameter-masker.ts` (redacts sensitive values from logged SQL).
- **Span attributes** — `tag-span-attributes.ts` (`parseTagsFromSql`).
- **Warning routing** — `warning-router.ts`.

## Usage

```ts
import { TelemetryProvider } from '@ts-linq/telemetry';
// Wire into DbContext options to emit OpenTelemetry spans/diagnostics.
```

## Package structure

```
src/
  provider/TelemetryProvider.ts
  diagnostic-emitter.ts, event-ids.ts
  parameter-masker.ts, tag-span-attributes.ts, warning-router.ts
  index.ts
```

## Dependencies

- `@ts-linq/types`

## License

Part of the ts-linq monorepo. See the repository root for license details.
