import 'reflect-metadata';
import { MetadataStorage } from '../metadata/MetadataStorage';
import type { IndexMetadata } from '../types';

export interface IndexOptions {
  name?: string;
  columns?: string[];
  unique?: boolean;
  expression?: string;
  where?: string;
}

/**
 * Class decorator to declare a database index for the entity's table.
 * Supports column-based, expression-based, and partial indexes.
 */
export function Index(options: IndexOptions): ClassDecorator {
  return function (target: Function) {
    const idx: IndexMetadata = {
      name: options.name || `IX_${target.name}_${(options.columns || ['expr']).join('_')}`,
      columns: options.columns || [],
      unique: !!options.unique,
      expression: options.expression,
      where: options.where
    };
    MetadataStorage.addIndex(target, idx);
  };
}

/**
 * Convenience decorator for a UNIQUE index.
 */
export function Unique(options: Omit<IndexOptions, 'unique'>): ClassDecorator {
  return Index({ ...options, unique: true });
}
