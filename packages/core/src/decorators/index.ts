import type { IndexMetadata } from '@ts-linq/types';
import { IndexOptionsBuilder } from '../utils/IndexOptionsBuilder';
import { PendingMetadataCollector } from '@ts-linq/metadata';

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
 * Metadata is collected in PendingMetadataCollector and finalized by @Entity.
 */
export function Index(options: IndexInput) {
  return function IndexDecorator(target: unknown, context: unknown) {
    if (!isStage3ClassContext(context)) {
      throw new Error('@Index requires TS5 Stage-3 decorators');
    }
    
    const ctor = target as Function;
    const meta: IndexMetadata = normalizeIndexOptions(options);
    
    // Use addInitializer to register after class is fully decorated
    context.addInitializer?.(function () {
      PendingMetadataCollector.addIndex(ctor, meta);
    });
  };
}
