# Logging, Sensitive Data, Detailed Errors, ConfigureWarnings

> **EF Core parity**: `LogTo` / `EnableSensitiveDataLogging` / `EnableDetailedErrors` / `ConfigureWarnings`

## Overview

`ts-linq` provides fine-grained control over diagnostic output through four fluent methods on `DbContextOptionsBuilder`. A single `DiagnosticEmitter` sits between the pipeline and your log sink, applying parameter masking, level filtering, and warning escalation in one place.

```ts
import { DbContextOptionsBuilder } from '@ts-linq/orm';
import { CoreEventId, RelationalEventId } from '@ts-linq/telemetry';

const options = new DbContextOptionsBuilder({ provider })
  .logTo(msg => console.log(msg), 'information')
  .enableSensitiveDataLogging()
  .enableDetailedErrors()
  .configureWarnings(w => w
    .throw(RelationalEventId.multipleCollectionIncludeWarning)
    .log(CoreEventId.firstWithoutOrderByAndFilterWarning))
  .build();
```

---

## API Reference

### `logTo(sink, level?)`

Directs all diagnostic messages to a user-supplied function.

| Parameter | Type | Description |
|-----------|------|-------------|
| `sink` | `(message: string) => void` | Receives each formatted diagnostic message |
| `level` | `LogLevel` (optional) | Minimum severity: `'trace'` \| `'debug'` \| `'information'` \| `'warning'` \| `'error'` \| `'critical'` \| `'none'`. Defaults to `'information'`. |

```ts
.logTo(msg => logger.info(msg), 'debug')
```

Events emitted below the configured level are silently dropped.

---

### `enableSensitiveDataLogging()`

Includes raw SQL parameter values in diagnostic messages.

> **⚠️ PII Warning**: By default, parameter values are replaced with positional placeholders (`:p0`, `:p1`, …) to prevent personally identifiable information from leaking into logs. Call `enableSensitiveDataLogging()` **only in non-production environments**.

```ts
.enableSensitiveDataLogging()
// Now params show as: [alice, 42] instead of [:p0, :p1]
```

---

### `enableDetailedErrors()`

Appends full stack traces to error diagnostic messages.

```ts
.enableDetailedErrors()
// Error messages now include the full call stack
```

---

### `configureWarnings(configure)`

Routes specific events to one of three behaviors:

| Method | Effect |
|--------|--------|
| `.throw(eventId)` | Throws `EfWarningError` when the event fires |
| `.log(eventId)` | Forces the event to be logged regardless of the configured log level |
| `.suppress(eventId)` | Silences the event entirely |

```ts
import { CoreEventId, RelationalEventId } from '@ts-linq/telemetry';

.configureWarnings(w => w
  .throw(RelationalEventId.multipleCollectionIncludeWarning)
  .log(CoreEventId.firstWithoutOrderByAndFilterWarning)
  .suppress(CoreEventId.sensitiveDataLoggingEnabled))
```

#### Available Event IDs

**`CoreEventId`**

| Constant | Event ID |
|----------|----------|
| `firstWithoutOrderByAndFilterWarning` | `core.first-without-order-by-and-filter` |
| `clientEvaluationWarning` | `core.client-evaluation` |
| `sensitiveDataLoggingEnabled` | `core.sensitive-data-logging-enabled` |
| `queryStart` | `core.query-start` |
| `queryEnd` | `core.query-end` |
| `queryError` | `core.query-error` |
| `transactionStart` | `core.transaction-start` |
| `transactionEnd` | `core.transaction-end` |
| `retry` | `core.retry` |

**`RelationalEventId`**

| Constant | Event ID |
|----------|----------|
| `multipleCollectionIncludeWarning` | `relational.multiple-collection-include` |
| `queryPossibleExpressionWarning` | `relational.query-possible-expression-warning` |

Custom string event IDs are also accepted.

---

## PII Compliance

Parameters are masked **by default**. You must explicitly call `enableSensitiveDataLogging()` to expose them. This mirrors EF Core's security-first design and helps comply with GDPR, HIPAA, and similar regulations.

**Safe (default):**
```
Executing SQL: SELECT * FROM users WHERE email = ? -- params: [:p0]
```

**Opt-in sensitive mode only:**
```
Executing SQL: SELECT * FROM users WHERE email = ? -- params: [alice@example.com]
```

---

## Interaction with OTEL Telemetry

`logTo()` adds a `DiagnosticEmitter` alongside any existing `SqlLogger` (e.g., `TelemetryProvider` for OpenTelemetry spans). Both loggers receive every event independently — enabling you to have structured OTEL spans **and** human-readable log output simultaneously.

```ts
const provider = new PostgresProvider({
  connectionString,
  logger: new TelemetryProvider({ tracer: otelTracer }),  // OTEL spans
});

const options = new DbContextOptionsBuilder({ provider })
  .logTo(msg => pino.info(msg), 'information')  // Text logs via pino
  .build();
```

---

## Architecture

```
Pipeline event
      │
      ▼
DiagnosticEmitter (SqlLogger)
      ├─ Check sensitiveDataEnabled → mask or expose params
      ├─ Check warningRoutes        → throw / log / suppress
      └─ Check minLevel             → filter by severity
             │
        ┌────┴────┐
        ▼         ▼
    logTo sink   (existing OTEL / SqlLogger via CompositeMerge)
```
