import type { EntityCtor } from '@ts-linq/types';

import { MetadataStorage } from './MetadataStorage';

export function ValidIf(
  predicate: (entity: unknown) => boolean,
  message?: string,
  options?: {
    phase?: 'onCreate' | 'onUpdate' | 'always';
    messageKey?: string;
    messageParams?: Record<string, unknown>;
  }
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    const name = propertyKey.toString();
    const ctor: EntityCtor =
      typeof target === 'function'
        ? (target as EntityCtor)
        : (target as { constructor: EntityCtor }).constructor;

    MetadataStorage.addValidationRule(ctor, {
      propertyName: name,
      predicate,
      message: message || '',
      phase: options?.phase,
      messageKey: options?.messageKey,
      messageParams: options?.messageParams
    });
  };
}

// ——— DX/Typing: strongly-typed predicates and helpers ———

export type EntityPredicate<T> = (entity: Readonly<T>) => boolean;

/** Type-safe form: requires explicit entity type. */
export function ValidIfOf<T>(predicate: EntityPredicate<T>, message?: string): PropertyDecorator {
  return ValidIf(predicate as (e: unknown) => boolean, message);
}

/** Requires non-empty property value when condition holds. */
export function RequiredIfOf<T>(
  condition: EntityPredicate<T>,
  message?: string
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    const propName = propertyKey.toString();
    const ctor: EntityCtor =
      typeof target === 'function'
        ? (target as EntityCtor)
        : (target as { constructor: EntityCtor }).constructor;

    const predicate = (entity: unknown): boolean => {
      const e = entity as Record<string, unknown>;
      if (!condition(entity as Readonly<T>)) return true;
      const v = e[propName];
      if (v === null || v === undefined) return false;
      if (typeof v === 'string') return v.trim().length > 0;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    };

    MetadataStorage.addValidationRule(ctor, {
      propertyName: propName,
      predicate,
      message: message || `${propName} is required`
    });
  };
}

/** Minimum string length constraint for a property. */
export function MinLengthOf<T>(min: number, message?: string): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    const propName = propertyKey.toString();
    const ctor: EntityCtor =
      typeof target === 'function'
        ? (target as EntityCtor)
        : (target as { constructor: EntityCtor }).constructor;

    const predicate = (entity: unknown): boolean => {
      const v = (entity as Record<string, unknown>)[propName];
      if (v === null || v === undefined) return true;
      if (typeof v === 'string') return v.length >= min;
      return true;
    };

    MetadataStorage.addValidationRule(ctor, {
      propertyName: propName,
      predicate,
      message: message || `Length must be >= ${min}`
    });
  };
}

/** Maximum string length constraint for a property. */
export function MaxLengthOf<T>(max: number, message?: string): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    const propName = propertyKey.toString();
    const ctor: EntityCtor =
      typeof target === 'function'
        ? (target as EntityCtor)
        : (target as { constructor: EntityCtor }).constructor;

    const predicate = (entity: unknown): boolean => {
      const v = (entity as Record<string, unknown>)[propName];
      if (v === null || v === undefined) return true;
      if (typeof v === 'string') return v.length <= max;
      return true;
    };

    MetadataStorage.addValidationRule(ctor, {
      propertyName: propName,
      predicate,
      message: message || `Length must be <= ${max}`
    });
  };
}

/** Regex pattern match for a string property. */
export function PatternOf<T>(regex: RegExp, message?: string): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    const propName = propertyKey.toString();
    const ctor: EntityCtor =
      typeof target === 'function'
        ? (target as EntityCtor)
        : (target as { constructor: EntityCtor }).constructor;

    const predicate = (entity: unknown): boolean => {
      const v = (entity as Record<string, unknown>)[propName];
      if (v === null || v === undefined) return true;
      if (typeof v === 'string') return regex.test(v);
      return true;
    };

    MetadataStorage.addValidationRule(ctor, {
      propertyName: propName,
      predicate,
      message: message || `Invalid format`
    });
  };
}

/** Numeric range constraint for a property (when value is a number). */
export function RangeOf<T>(min?: number, max?: number, message?: string): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    const propName = propertyKey.toString();
    const ctor: EntityCtor =
      typeof target === 'function'
        ? (target as EntityCtor)
        : (target as { constructor: EntityCtor }).constructor;

    const predicate = (entity: unknown): boolean => {
      const v = (entity as Record<string, unknown>)[propName];
      if (v === null || v === undefined) return true;
      if (typeof v === 'number') {
        if (typeof min === 'number' && v < min) return false;
        if (typeof max === 'number' && v > max) return false;
      }
      return true;
    };

    MetadataStorage.addValidationRule(ctor, {
      propertyName: propName,
      predicate,
      message: message || `Out of range`
    });
  };
}
