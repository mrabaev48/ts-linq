import { ValueConverter } from '../ValueConverter';

/**
 * Creates a converter that stores enum values as their string representation.
 *
 * @example
 *   enum Role { Admin = 'admin', User = 'user' }
 *   const converter = createEnumToStringConverter(Role);
 *   // toProvider(Role.Admin) => 'admin'
 *   // fromProvider('admin') => Role.Admin
 */
export function createEnumToStringConverter<T extends string>(
  enumObj: Record<string, T>
): ValueConverter<T, string> {
  const reverseMap: Record<string, T> = {};
  for (const key of Object.keys(enumObj)) {
    reverseMap[enumObj[key]] = enumObj[key];
  }
  return new ValueConverter<T, string>(
    (v) => String(v),
    (v) => reverseMap[v] ?? (v as T)
  );
}

/** Simple enum-to-string converter using String() coercion (no reverse mapping). */
export const EnumToStringConverter = new ValueConverter<string, string>(
  (v) => String(v),
  (v) => v
);
