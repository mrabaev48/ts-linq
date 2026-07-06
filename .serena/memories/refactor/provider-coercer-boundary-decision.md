# Provider coercer consolidation — boundary decision + fail-fast preservation (planning)

Фиксация решения после coercion fail-fast sweep (см. [[refactor/dialect-postgres/task-5-coercion-fail-fast-sweep]]).

## Кто консолидирует провайдерный coerce
`provider-*/task-2` (анкер = `provider-mssql/task-2`), «Extract shared EntityMapper + ValueCoercer»,
status not-started, effort L. НЕ путать с `provider-*/task-4` (capability model) и с
`dialect-postgres/task-4` (тот дедуплицировал только ДИАЛЕКТНЫЕ copies → dialect-kit, done).

## Решённая граница (было открыто «core vs new package»)
- Дом коллабораторов = **новый `@ts-linq/provider-kit`** (deps: core, types, metadata, **dialect-kit**),
  НЕ core.
- `ValueCoercer.coerce(value, property?)` = цепочка encoder'ов (hierarchyId/geometry на провайдер),
  затем **делегирование хвоста в `coerceSqlParameter` из `@ts-linq/dialect-kit`** (единственная
  каноническая fail-fast реализация). Никакого локального primitive/JSON-хвоста, никакого `String()`.
- Почему provider-kit, а не core: core НЕ может зависеть от dialect-kit (граница + латентный цикл,
  когда dialect-kit получит base dialect, dialect-*/task-1). provider-kit выше слоя диалектов
  (провайдеры уже → dialect-* → dialect-kit), поэтому `provider-kit → dialect-kit` направленно верно
  и ацикличен. Acceptance требует зелёный arch:deps/cycles.

## Fail-fast preservation (главное «не откатить долг»)
Спека task-2 РАНЬШЕ вшивала старый `String` fallback в testing plan. Исправлено во всех трёх task-2
+ добавлен callout-блок: fail-fast + `ParameterCoercionError` уже поставлены (task-5 + sweep), task-2 —
чистая консолидация, НЕ поведенческое изменение; хвост обязан делегироваться в канонический
coerceSqlParameter и никогда не падать в String(value). Testing plan переписан: circular → throws
ParameterCoercionError, bigint → string.

## core/query (вне scope provider-task-2)
`SqlHelper.ensureSqlParameter` (core) и `SetPropertyCalls` (query) — отдельные копии того же хвоста;
их нельзя слить в dialect-kit (та же граница). Заведён **новый `core/task-10`** (P3, optional):
единый `coerceParameterValue` в core, переиспользуемый SqlHelper + query/SetPropertyCalls (query→core
уже есть). Репозиторий сознательно держит ДВА канонических хвоста: dialect-kit (диалекты+provider-kit)
и core (core+query). Единый на весь репо потребовал бы zero-dep пакета ниже обоих слоёв — не оправдано
для ~8-строчной функции.

## Обновлённые файлы (только docs)
provider-{mssql,postgres,mysql}/task-2.md + их README; новый core/task-10.md; core/README (проблемы+
order+нота); query/README (нота); top-level refactor/README (core 9→10 в tracking; provider tier note
про provider-kit). Кода не трогали.
