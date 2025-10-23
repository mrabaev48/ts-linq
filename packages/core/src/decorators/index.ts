import type { IndexMetadata } from '@ts-linq/types';
import { IndexOptionsBuilder } from '../utils/IndexOptionsBuilder';

// Re-export all decorators
export { IndexOptionsBuilder } from '../utils/IndexOptionsBuilder';
export {
  ValidIf,
  ValidIfOf,
  RequiredIfOf,
  MinLengthOf,
  MaxLengthOf,
  PatternOf,
  RangeOf
} from './ValidIf';
export { Entity } from './Entity';
export { Column } from './Column';
export { PrimaryKey } from './PrimaryKey';
export { ManyToOne, OneToMany, OneToOne, ManyToMany } from './Relationships';
export { clearOrphanedMetadata } from './utils';

function isStage3ClassContext(x: unknown): x is {
  kind: 'class';
  addInitializer?: (fn: () => void) => void;
} {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'class';
}

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
 * Class decorator that registers an index on the entity.
 * Uses orphaned metadata pattern to work with SWC 2022-03.
 */
export function Index(options: IndexInput) {
  return function IndexDecorator(target: unknown, context: unknown) {
    if (!isStage3ClassContext(context)) {
      throw new Error('@Index requires TS5 Stage-3 decorators');
    }
    
    const ctor = target as Function;
    const meta: IndexMetadata = normalizeIndexOptions(options);
    
    // Save to globalThis for @Entity to collect
    if (!(globalThis as any).__tsLinqOrphanedIndexes) {
      (globalThis as any).__tsLinqOrphanedIndexes = [];
    }
    
    (globalThis as any).__tsLinqOrphanedIndexes.push({
      ctor,
      metadata: meta
    });
  };
}
