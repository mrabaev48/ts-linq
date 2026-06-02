---
status: not-started
phase: phase-x
package: cli
priority: P3
effort: S
risk: low
category: clean-code
depends_on: []
related: ["cli/task-3.md"]
---

# Refactor: Standardize user-facing strings (MetricsServeCommand i18n inconsistency)

## Problem

The CLI's user-facing output is English everywhere except `MetricsServeCommand`, whose
description and all runtime messages are in Russian. This is an inconsistency that surprises
users, breaks any output-scraping tests/tooling that assume English, and reflects a lack of
a centralized message convention.

## Evidence

- `packages/cli/src/commands/MetricsServeCommand.ts:9` — `describe = 'Запускает HTTP-сервер
  для экспорта метрик Prometheus'`.
- `packages/cli/src/commands/MetricsServeCommand.ts:18` — `Prometheus metrics server
  запущен: …`.
- `packages/cli/src/commands/MetricsServeCommand.ts:20` — `Получен сигнал ${signal}.
  Остановка метрик...`.
- `packages/cli/src/commands/MetricsServeCommand.ts:23,25,34,38` — further Russian messages
  (`Сервер метрик остановлен.`, `Ошибка при остановке…`, `HTTP-сервер метрик закрыт`,
  `Не удалось запустить сервер метрик…`).
- For contrast, all other command descriptions are English (e.g.
  `ScaffoldCommand.ts:16`, `SchemaApplyCommand.ts:19`, `MigrationsRollbackCommand.ts:15`).

## Why this is bad

- **Inconsistent UX** in a single tool.
- **Brittle tests/tooling:** the existing `tests/metrics-serve.test.ts` and any catalog/help
  snapshot could depend on language; mixed languages make help output incoherent.
- **No message convention:** strings are inlined, so there is no single place to enforce
  language/format.

## Target architecture

Apply **Clean Code** (consistency) and a light **single-source-of-truth** for user-facing
strings. Minimum: make every message English to match the rest of the CLI. Optional: route
all command messages through a small `messages` module so tone/format/language is centrally
governed (and a future i18n layer is possible).

## Proposed refactor

1. Translate the `MetricsServeCommand` `describe` and all runtime messages to English,
   matching the phrasing style of the other commands.
2. Ensure messages go through the injected `Logger` (already the case here) and align with
   the cli/task-3 error model for the failure path (`Не удалось запустить…` → a typed
   `CliError` with a user-safe English message).
3. (Optional) Introduce a `messages.ts` constant map if the team wants a single governance
   point.

Public command name/aliases (`metrics:serve`, `metrics`, `prometheus`) unchanged.

## Suggested design patterns

- **Single source of truth (message constants)** — optional centralization. Why: consistent
  tone/language, future i18n.
- **Consistency principle (Clean Code)** — match surrounding conventions. Why: coherent UX.

## Testing plan

- **Regression:** `tests/metrics-serve.test.ts` updated to the English strings.
- **Catalog test:** help/catalog output is uniformly English (extend
  `tests/cli-help-aliases.test.ts` if it snapshots descriptions).

## Acceptance criteria

- [ ] `MetricsServeCommand` description and runtime messages are English, consistent with
      other commands.
- [ ] The failure path uses the cli/task-3 error model (if landed) or a clear English error.
- [ ] Affected tests updated and passing.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm tests:unit`, `pnpm build` pass.

## Refactor order

1. Translate strings.
2. Align the failure path with the error model.
3. (Optional) centralize into `messages.ts`.

## Notes

Lowest-priority polish; safe to bundle with cli/task-3. Confirm with maintainers whether a
real i18n layer is desired before adding `messages.ts` infrastructure.
