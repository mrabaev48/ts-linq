import 'reflect-metadata';
import { MetadataStorage } from '../metadata/MetadataStorage';
import type { ValidationRule } from '../types';

function isStage3FieldContext(x: unknown): x is { kind: 'field'; name: string | symbol; addInitializer?(fn: (this: unknown) => void): void } {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'field' && 'name' in (x as object);
}

export function ValidIf(predicate: (entity: unknown) => boolean, message?: string): PropertyDecorator {
  return function ValidIfDecorator(_targetOrValue: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext)) {
      throw new Error('@ValidIf requires TS5 Stage-3 decorators');
    }
    const ctx = propOrContext;
    const name = ctx.name.toString();
    ctx.addInitializer?.(function (this: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor as Function | undefined;
      if (!ctor) return;
      const existing: ValidationRule[] = (Reflect.getOwnMetadata('orm:validations', ctor) as ValidationRule[]) || [];
      existing.push({ propertyName: name, predicate, message });
      Reflect.defineMetadata('orm:validations', existing, ctor);
    });
  };
}


