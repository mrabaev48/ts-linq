import { MetadataStorage } from '../metadata/MetadataStorage';
import type { IndexMetadata } from '../types';
import { IndexOptionsBuilder } from '../utils/IndexOptionsBuilder';
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

function isStage3ClassContext(x: unknown): x is ClassDecoratorContext {
  return !!x && typeof x === 'object';
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

export function Index(options: IndexInput) {
  return function IndexDecorator(_target: unknown, context: ClassDecoratorContext) {
    if (context.kind !== 'class') {
      throw new Error('@Index requires TS5 Stage-3 decorators');
    }
    context.addInitializer?.(function () {
      const ctor = this as unknown as Function;
      if (!ctor) return;
      const meta: IndexMetadata = normalizeIndexOptions(options);
      // Stage-3: Use MetadataStorage instead of Reflect API
      MetadataStorage.addIndex(ctor, meta);
    });
  };
}

// no re-exports from here
