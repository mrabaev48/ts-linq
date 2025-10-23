import type { IndexMetadata } from '@ts-linq/types';
import { IndexOptionsBuilder } from '../utils/IndexOptionsBuilder';
import { PENDING_INDEXES } from './Column';

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
  metadata?: Record<symbol, unknown>;
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
 * Uses context.metadata to share data with @Entity decorator.
 */
export function Index(options: IndexInput) {
  return function IndexDecorator(_target: unknown, context: unknown) {
    if (!isStage3ClassContext(context)) {
      throw new Error('@Index requires TS5 Stage-3 decorators');
    }
    
    // Store index metadata in shared context.metadata
    if (context.metadata) {
      if (!context.metadata[PENDING_INDEXES]) {
        context.metadata[PENDING_INDEXES] = [];
      }
      
      const indexes = context.metadata[PENDING_INDEXES] as IndexMetadata[];
      const meta: IndexMetadata = normalizeIndexOptions(options);
      indexes.push(meta);
    }
  };
}
