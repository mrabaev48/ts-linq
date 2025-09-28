import 'reflect-metadata';
import { MetadataStorage } from '../metadata/MetadataStorage';
import type { ValidationRule } from '../types';

function isStage3FieldContext(
  x: unknown
): x is {
  kind: 'field';
  name: string | symbol;
  addInitializer?(fn: (this: unknown) => void): void;
} {
  return (
    !!x &&
    typeof x === 'object' &&
    (x as { kind?: unknown }).kind === 'field' &&
    'name' in (x as object)
  );
}

export function ValidIf(
  predicate: (entity: unknown) => boolean,
  message?: string,
  options?: {
    phase?: 'onCreate' | 'onUpdate' | 'always';
    messageKey?: string;
    messageParams?: Record<string, unknown>;
  }
): PropertyDecorator {
  return function ValidIfDecorator(_targetOrValue: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext)) {
      throw new Error('@ValidIf requires TS5 Stage-3 decorators');
    }
    const ctx = propOrContext;
    const name = ctx.name.toString();
    ctx.addInitializer?.(function (this: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor as Function | undefined;
      if (!ctor) return;
      const existing: ValidationRule[] =
        (Reflect.getOwnMetadata('orm:validations', ctor) as ValidationRule[]) || [];
      existing.push({
        propertyName: name,
        predicate,
        message,
        phase: options?.phase,
        messageKey: options?.messageKey,
        messageParams: options?.messageParams
      });
      Reflect.defineMetadata('orm:validations', existing, ctor);
    });
  };
}

// ——— DX/Typing: strongly-typed predicates and helpers ———

export type EntityPredicate<T> = (entity: Readonly<T>) => boolean;

/** Type-safe form: requires explicit entity type. */
export function ValidIfOf<T>(predicate: EntityPredicate<T>, message?: string): PropertyDecorator {
  // Reuse runtime implementation; typing is ensured by the signature
  return ValidIf(predicate as unknown as (e: unknown) => boolean, message);
}

/** Requires non-empty property value when condition holds. */
export function RequiredIfOf<T>(
  condition: EntityPredicate<T>,
  message?: string
): PropertyDecorator {
  return function RequiredIfDecorator(_targetOrValue: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext)) {
      throw new Error('@RequiredIfOf requires TS5 Stage-3 decorators');
    }
    const ctx = propOrContext;
    const propName = ctx.name.toString();
    ctx.addInitializer?.(function (this: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor as Function | undefined;
      if (!ctor) return;
      const existing: ValidationRule[] =
        (Reflect.getOwnMetadata('orm:validations', ctor) as ValidationRule[]) || [];
      const predicate = (entity: unknown): boolean => {
        const e = entity as Record<string, unknown>;
        if (!condition(e as unknown as T)) return true;
        const v = e[propName];
        if (v === null || v === undefined) return false;
        if (typeof v === 'string') return v.trim().length > 0;
        if (Array.isArray(v)) return v.length > 0;
        return true;
      };
      existing.push({
        propertyName: propName,
        predicate,
        message: message || `${propName} is required`
      });
      Reflect.defineMetadata('orm:validations', existing, ctor);
    });
  };
}

/** Minimum string length constraint for a property. */
export function MinLengthOf<T>(min: number, message?: string): PropertyDecorator {
  return function MinLengthDecorator(_targetOrValue: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext))
      throw new Error('@MinLengthOf requires TS5 Stage-3 decorators');
    const ctx = propOrContext;
    const propName = ctx.name.toString();
    ctx.addInitializer?.(function (this: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor as Function | undefined;
      if (!ctor) return;
      const existing: ValidationRule[] =
        (Reflect.getOwnMetadata('orm:validations', ctor) as ValidationRule[]) || [];
      const predicate = (entity: unknown): boolean => {
        const v = (entity as Record<string, unknown>)[propName];
        if (v === null || v === undefined) return true; // NotNull is checked separately
        if (typeof v === 'string') return v.length >= min;
        return true;
      };
      existing.push({
        propertyName: propName,
        predicate,
        message: message || `Length must be >= ${min}`
      });
      Reflect.defineMetadata('orm:validations', existing, ctor);
    });
  };
}

/** Maximum string length constraint for a property. */
export function MaxLengthOf<T>(max: number, message?: string): PropertyDecorator {
  return function MaxLengthDecorator(_targetOrValue: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext))
      throw new Error('@MaxLengthOf requires TS5 Stage-3 decorators');
    const ctx = propOrContext;
    const propName = ctx.name.toString();
    ctx.addInitializer?.(function (this: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor as Function | undefined;
      if (!ctor) return;
      const existing: ValidationRule[] =
        (Reflect.getOwnMetadata('orm:validations', ctor) as ValidationRule[]) || [];
      const predicate = (entity: unknown): boolean => {
        const v = (entity as Record<string, unknown>)[propName];
        if (v === null || v === undefined) return true;
        if (typeof v === 'string') return v.length <= max;
        return true;
      };
      existing.push({
        propertyName: propName,
        predicate,
        message: message || `Length must be <= ${max}`
      });
      Reflect.defineMetadata('orm:validations', existing, ctor);
    });
  };
}

/** Regex pattern match for a string property. */
export function PatternOf<T>(regex: RegExp, message?: string): PropertyDecorator {
  return function PatternDecorator(_targetOrValue: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext))
      throw new Error('@PatternOf requires TS5 Stage-3 decorators');
    const ctx = propOrContext;
    const propName = ctx.name.toString();
    ctx.addInitializer?.(function (this: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor as Function | undefined;
      if (!ctor) return;
      const existing: ValidationRule[] =
        (Reflect.getOwnMetadata('orm:validations', ctor) as ValidationRule[]) || [];
      const predicate = (entity: unknown): boolean => {
        const v = (entity as Record<string, unknown>)[propName];
        if (v === null || v === undefined) return true;
        if (typeof v === 'string') return regex.test(v);
        return true;
      };
      existing.push({ propertyName: propName, predicate, message: message || `Invalid format` });
      Reflect.defineMetadata('orm:validations', existing, ctor);
    });
  };
}

/** Numeric range constraint for a property (when value is a number). */
export function RangeOf<T>(min?: number, max?: number, message?: string): PropertyDecorator {
  return function RangeDecorator(_targetOrValue: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext))
      throw new Error('@RangeOf requires TS5 Stage-3 decorators');
    const ctx = propOrContext;
    const propName = ctx.name.toString();
    ctx.addInitializer?.(function (this: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor as Function | undefined;
      if (!ctor) return;
      const existing: ValidationRule[] =
        (Reflect.getOwnMetadata('orm:validations', ctor) as ValidationRule[]) || [];
      const predicate = (entity: unknown): boolean => {
        const v = (entity as Record<string, unknown>)[propName];
        if (v === null || v === undefined) return true;
        if (typeof v === 'number') {
          if (typeof min === 'number' && v < min) return false;
          if (typeof max === 'number' && v > max) return false;
        }
        return true;
      };
      existing.push({ propertyName: propName, predicate, message: message || `Out of range` });
      Reflect.defineMetadata('orm:validations', existing, ctor);
    });
  };
}
