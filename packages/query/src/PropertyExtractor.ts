import { MetadataStorage } from '@ts-linq/metadata';

/**
 * Static utility for extracting property names from lambda selector strings.
 * Centralises all regex-based parsing that was previously scattered across Queryable.
 */
export class PropertyExtractor {
  private static readonly REGEX_SINGLE_PROP = /=>\s*\w+\.(\w+)/;
  private static readonly REGEX_OBJECT = /=>\s*\(\s*\{([^}]+)\}\s*\)/;
  private static readonly REGEX_SIMPLE_OBJECT = /=>\s*\{([^}]+)\}/;
  private static readonly REGEX_PROP_IN_OBJECT = /\w+:\s*\w+\.(\w+)/;
  private static readonly REGEX_ANY_PROP = /(\w+)/;
  private static readonly SELECTOR_CACHE_MAX = 1000;

  private static _selectorPropsCache: Map<string, string[]> = new Map();
  private static _keySelectorCache: Map<string, string> = new Map();
  private static _includePropCache: Map<string, string> = new Map();

  /** Extract a simple property name from an arrow/function selector, e.g. `e => e.amount` → `"amount"`. */
  static extractPropertyName<T, K extends keyof T>(selector: (entity: T) => T[K]): string {
    const str = selector.toString();
    const arrowMatch = /=>\s*[a-zA-Z_$][\w$]*\.([a-zA-Z_$][\w$]*)/.exec(str);
    if (arrowMatch) return arrowMatch[1];
    const returnMatch = /return\s+[a-zA-Z_$][\w$]*\.([a-zA-Z_$][\w$]*)/.exec(str);
    if (returnMatch) return returnMatch[1];
    throw new Error(
      `ts-linq: cannot extract property name from selector. ` +
        `Use a simple property accessor like \`e => e.propertyName\`. Got: ${str}`
    );
  }

  /** Resolve a TypeScript property name to its database column name via entity metadata. */
  static resolveColumnName<T>(entityClass: new () => T, propName: string): string {
    const meta = MetadataStorage.getEntity(entityClass);
    return meta?.columns.find((c) => c.propertyName === propName)?.columnName ?? propName;
  }

  /** Extracts include property name from a lambda selector. */
  static extractIncludeProperty<T>(selector: (entity: T) => unknown): string {
    const selectorStr = selector.toString();
    const cached = PropertyExtractor._includePropCache.get(selectorStr);
    if (cached) return cached;
    const match = selectorStr.match(PropertyExtractor.REGEX_SINGLE_PROP);
    if (match && match[1]) {
      PropertyExtractor._includePropCache.set(selectorStr, match[1]);
      return match[1];
    }
    throw new Error(`Unable to parse include selector: ${selectorStr}`);
  }

  /**
   * Extract property names from a projection selector function string.
   * Supports single property, object destructuring, and simple object literal forms.
   */
  static extractPropertiesFromSelector(selectorStr: string): string[] {
    const cached = PropertyExtractor._selectorPropsCache.get(selectorStr);
    if (cached) return [...cached];
    const singleMatch = selectorStr.match(PropertyExtractor.REGEX_SINGLE_PROP);
    if (singleMatch) return [singleMatch[1]];
    const objectMatch = selectorStr.match(PropertyExtractor.REGEX_OBJECT);
    if (objectMatch) {
      const props = objectMatch[1].split(',');
      const result = props.map((prop) => {
        const match = prop.match(PropertyExtractor.REGEX_PROP_IN_OBJECT);
        return match ? match[1] : prop.trim();
      });
      PropertyExtractor._selectorPropsCache.set(selectorStr, [...result]);
      return result;
    }
    const simpleObjectMatch = selectorStr.match(PropertyExtractor.REGEX_SIMPLE_OBJECT);
    if (simpleObjectMatch) {
      const props = simpleObjectMatch[1].split(',');
      const result = props.map((prop) => {
        const match =
          prop.match(PropertyExtractor.REGEX_PROP_IN_OBJECT) ||
          prop.match(PropertyExtractor.REGEX_ANY_PROP);
        return match ? match[1] : prop.trim();
      });
      PropertyExtractor._selectorPropsCache.set(selectorStr, [...result]);
      return result;
    }
    return ['*'];
  }

  /**
   * Extract a single property name from a key selector function string.
   * Throws if parsing fails.
   */
  static extractPropertyFromKeySelector(keySelectorStr: string): string {
    const cached = PropertyExtractor._keySelectorCache.get(keySelectorStr);
    if (cached) return cached;
    const match = keySelectorStr.match(PropertyExtractor.REGEX_SINGLE_PROP);
    if (match) {
      PropertyExtractor._keySelectorCache.set(keySelectorStr, match[1]);
      return match[1];
    }
    throw new Error(`Unable to parse key selector: ${keySelectorStr}`);
  }
}
