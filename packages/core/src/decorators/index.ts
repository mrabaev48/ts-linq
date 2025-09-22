import 'reflect-metadata';
import { MetadataStorage } from '../metadata/MetadataStorage';
import type { IndexMetadata } from '../types';

function isStage3ClassContext(x: unknown): x is ClassDecoratorContext {
  return !!x && typeof x === 'object';
}

export interface IndexOptions {
  name: string;
  columns: string[];
  unique?: boolean;
  where?: string;
}

export function Index(options: IndexOptions) {
  return function IndexDecorator(_target: unknown, context: ClassDecoratorContext) {
    if (context.kind !== 'class') {
      throw new Error('@Index requires TS5 Stage-3 decorators');
    }
    context.addInitializer?.(function () {
      const ctor = (this as { constructor?: Function })?.constructor as Function | undefined;
      if (!ctor) return;
      const meta: IndexMetadata = {
        name: options.name,
        columns: options.columns,
        unique: options.unique ?? false,
        where: options.where
      };
      MetadataStorage.addIndex(ctor, meta);
      const existing: IndexMetadata[] = Reflect.getOwnMetadata('orm:indexes', ctor) || [];
      existing.push(meta);
      Reflect.defineMetadata('orm:indexes', existing, ctor);
    });
  };
}

// no re-exports from here
