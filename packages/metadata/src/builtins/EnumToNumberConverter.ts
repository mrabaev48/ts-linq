import { ValueConverter } from '../ValueConverter';

/**
 * Creates a converter that stores enum values as their numeric representation.
 *
 * @example
 *   enum Status { Active = 0, Inactive = 1 }
 *   const converter = createEnumToNumberConverter(Status);
 *   // toProvider(Status.Active) => 0
 *   // fromProvider(0) => Status.Active (0)
 */
export function createEnumToNumberConverter<T extends number>(
  _enumObj?: Record<string, T>
): ValueConverter<T, number> {
  return new ValueConverter<T, number>(
    (v) => Number(v),
    (v) => v as T
  );
}

/** Simple enum-to-number converter using Number() coercion. */
export const EnumToNumberConverter = new ValueConverter<number, number>(
  (v) => Number(v),
  (v) => v
);
