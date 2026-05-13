# Issue #19 — `PropertyExtractor` содержит два мёртвых метода с рантайм-парсингом

**Severity:** Medium  
**Status:** Открыт  
**Affected files:**
- `packages/query/src/PropertyExtractor.ts` — `extractPropertyName()` (строки ~20–35), `extractIncludeProperty()` (строки ~39–55)

---

## Описание проблемы

После завершения issue #17 (переход на `keyof T` + трансформер) два публичных метода `PropertyExtractor` остались без единого вызывающего из продакшн-кода:

| Метод | Тип | Вызывается из |
|-------|-----|---------------|
| `extractPropertyName<T, K>(selector)` | `.toString()` + regex | Только тесты (`PropertyExtractor.test.ts`) |
| `extractIncludeProperty<T>(selector)` | `.toString()` + regex | Только тесты (`PropertyExtractor.test.ts`) |

```ts
// PropertyExtractor.ts ~20
static extractPropertyName<T, K extends keyof T>(selector: (entity: T) => T[K]): string {
  const str = selector.toString();  // ← рантайм парсинг
  const match = str.match(PropertyExtractor.REGEX_SINGLE_PROP);
  if (!match?.[1]) throw new Error(`cannot extract property name from: ${str}`);
  return match[1];
}

// PropertyExtractor.ts ~39
static extractIncludeProperty<T>(selector: (entity: T) => unknown): string {
  const selectorStr = selector.toString();  // ← рантайм парсинг
  const match = selectorStr.match(PropertyExtractor.REGEX_SINGLE_PROP);
  if (!match?.[1]) throw new Error(`Unable to parse include selector: ${selectorStr}`);
  return match[1];
}
```

Оба метода были созданы при декомпозиции god-класса (`Queryable.ts`) как часть рефакторинга issue #10, перенесены из методов, которые использовались до issue #17. После закрытия issue #17 они стали мёртвым кодом.

---

## Почему это проблема

### 1. Публичный API экспортирует сломанный контракт

`PropertyExtractor` экспортируется из `packages/query/src/index.ts`:
```ts
export * from './PropertyExtractor';
```

Потребители пакета видят `PropertyExtractor.extractPropertyName()` и `PropertyExtractor.extractIncludeProperty()` как часть публичного API. Оба метода сломаются при минификации — это documented-выглядящий, но broken-by-design API.

### 2. Тесты тестируют мёртвый код

`packages/query/tests-new/PropertyExtractor.test.ts` содержит тест-кейсы для этих двух методов (строки 27–79). Они дают ложное ощущение покрытия и замедляют ci без пользы.

### 3. Мусорный regex-инфраструктур остаётся живым

Пока методы существуют, константы `REGEX_SINGLE_PROP` и `_includePropCache` не могут быть удалены. После удаления методов — эти константы тоже станут кандидатами на удаление (если `extractPropertiesFromSelector` и `extractPropertyFromKeySelector` тоже не нужны).

---

## Что нужно сделать

1. Удалить `extractPropertyName()` из `PropertyExtractor.ts`
2. Удалить `extractIncludeProperty()` из `PropertyExtractor.ts`
3. Удалить соответствующие тест-кейсы из `PropertyExtractor.test.ts` (блоки `describe('extractPropertyName')` и `describe('extractIncludeProperty')`)
4. Проверить, остались ли другие методы `PropertyExtractor` используемыми; если нет — удалить весь класс и убрать экспорт из `index.ts`
5. Если `REGEX_SINGLE_PROP` и `_includePropCache` стали неиспользуемыми — удалить

---

## Связанные issues

- Issue #17 — первопричина: эти методы стали мёртвыми после полного перехода на `keyof T`
- Issue #18 — аналогичная проблема в `join()` с `JoinPredicateParser`
