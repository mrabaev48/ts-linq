import 'reflect-metadata';

import { MetadataStorage } from '@ts-linq/metadata';
import type { IndexMetadata } from '@ts-linq/types';

import { IndexOptionsBuilder } from '../utils/IndexOptionsBuilder';

// Re-export all decorators
export { IndexOptionsBuilder } from '../utils/IndexOptionsBuilder';
export { Column } from './Column';
export { Entity } from './Entity';
export { PrimaryKey } from './PrimaryKey';
export { ManyToMany, ManyToOne, OneToMany, OneToOne } from './Relationships';
export {
  MaxLengthOf,
  MinLengthOf,
  PatternOf,
  RangeOf,
  RequiredIfOf,
  ValidIf,
  ValidIfOf
} from './ValidIf';

export interface IndexOptions {
  name: string;
  columns: string[];
  unique?: boolean;
  where?: string;
  orders?: { [column: string]: 'ASC' | 'DESC' };
  expressions?: string[];
  collations?: { [column: string]: string };
  nulls?: { [column: string]: 'FIRST' | 'LAST' };
  using?: 'btree' | 'hash' | 'gin' | 'gist';
  concurrently?: boolean;
  withParams?: Record<string, string | number | boolean>;
  mysqlVisibility?: 'VISIBLE' | 'INVISIBLE';
  include?: string[];
}

export type IndexInput = IndexOptions | IndexOptionsBuilder;

export function normalizeIndexOptions(input: IndexInput): IndexMetadata {
  const built: IndexMetadata =
    input instanceof IndexOptionsBuilder
      ? input.build()
      : {
          name: input.name,
          columns: input.columns,
          unique: input.unique ?? false,
          where: input.where,
          orders: input.orders,
          expressions: input.expressions,
          collations: input.collations,
          nulls: input.nulls,
          using: input.using,
          concurrently: input.concurrently,
          withParams: input.withParams,
          mysqlVisibility: input.mysqlVisibility,
          include: input.include
        };
  return built;
}

/**
 * Legacy class decorator that registers an index on the entity.
 * Uses reflect-metadata for metadata storage.
 */
export function Index(options: IndexInput): ClassDecorator {
  return function <TFunction extends Function>(target: TFunction): TFunction | void {
    const ctor = target as Function;
    const meta: IndexMetadata = normalizeIndexOptions(options);

    MetadataStorage.addIndex(ctor, meta);

    return target;
  };
}
