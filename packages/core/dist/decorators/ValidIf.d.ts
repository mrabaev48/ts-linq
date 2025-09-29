import 'reflect-metadata';
export declare function ValidIf(
  predicate: (entity: unknown) => boolean,
  message?: string,
  options?: {
    phase?: 'onCreate' | 'onUpdate' | 'always';
    messageKey?: string;
    messageParams?: Record<string, unknown>;
  }
): PropertyDecorator;
export type EntityPredicate<T> = (entity: Readonly<T>) => boolean;
/** Type-safe form: requires explicit entity type. */
export declare function ValidIfOf<T>(
  predicate: EntityPredicate<T>,
  message?: string
): PropertyDecorator;
/** Requires non-empty property value when condition holds. */
export declare function RequiredIfOf<T>(
  condition: EntityPredicate<T>,
  message?: string
): PropertyDecorator;
/** Minimum string length constraint for a property. */
export declare function MinLengthOf<T>(min: number, message?: string): PropertyDecorator;
/** Maximum string length constraint for a property. */
export declare function MaxLengthOf<T>(max: number, message?: string): PropertyDecorator;
/** Regex pattern match for a string property. */
export declare function PatternOf<T>(regex: RegExp, message?: string): PropertyDecorator;
/** Numeric range constraint for a property (when value is a number). */
export declare function RangeOf<T>(min?: number, max?: number, message?: string): PropertyDecorator;
//# sourceMappingURL=ValidIf.d.ts.map
