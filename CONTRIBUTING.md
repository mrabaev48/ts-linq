# Contributing Guide

Спасибо за интерес к проекту! Здесь кратко описаны требования к стилю, коммитам и запуску проверок.

## Code style

- TypeScript strict, без `any` и небезопасных приведений типов.
- Имена: функции — глаголы, сущности/классы — существительные; избегаем аббревиатур.
- Малые функции, ранние return; в горячих путях избегаем try/catch — используем safe‑хелперы.
- Комментарии — «зачем», а не «как».

Форматирование и линтинг:

```bash
npm run format     # prettier --write
npm run lint       # eslint --max-warnings=0
```

## Коммиты и PR

- Сообщения в стиле conventional commits: `feat|fix|perf|refactor|docs|test|chore(scope): message`.
- Небольшие PR с тестами и описанием (что/зачем/как проверить).
- Public API не ломаем без мажорного релиза (semver).

## Тесты и билд

```bash
npm test           # jest
npm run build      # tsc CJS+ESM
```

## Бенчмарки и профилирование

```bash
npm run bench            # быстрый SQLite бенч (avg/p95/p99)
npm run bench:multi      # SQLite/PG/MySQL по env (CSV/JSON)
# Профили
npm run bench:profile:cpu
npm run bench:profile:heap
```

Переменные окружения для multi: `POSTGRES_URL`, `MYSQL_URL`, `BENCH_PROVIDERS`, `BENCH_FORMAT`.

## Документация и TypeDoc

```bash
npm run docs             # сгенерировать документацию в ./docs
```

См. также `docs/guides/architecture.md` и разделы «Benchmarks & profiling», «Alerting» в README.

## Метрики и алертинг

- Prometheus: `db_query_total`, `db_query_duration_ms`, `db_error_total`, `db_retry_total`, `db_active_transactions`, `db_cache_*`.
- Пример дашборда: `docs/assets/grafana-dashboard.json`.
- Ориентиры по p95/p99 и пороги Alertmanager — в README.

## Как предложить изменения

1. Форк/ветка.
2. Изменения + тесты + `npm run lint` + `npm test`.
3. PR с описанием и ссылками на задачи.

Спасибо!
