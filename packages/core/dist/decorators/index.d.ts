import 'reflect-metadata';
import type { IndexMetadata } from '../types';
import { IndexOptionsBuilder } from '../utils/IndexOptionsBuilder';
export { IndexOptionsBuilder } from '../utils/IndexOptionsBuilder';
export interface IndexOptions {
    name: string;
    columns: string[];
    unique?: boolean;
    where?: string;
    orders?: {
        [column: string]: 'ASC' | 'DESC';
    };
    expressions?: string[];
    collations?: {
        [column: string]: string;
    };
    nulls?: {
        [column: string]: 'FIRST' | 'LAST';
    };
    using?: 'btree' | 'hash' | 'gin' | 'gist';
    concurrently?: boolean;
    withParams?: Record<string, string | number | boolean>;
    mysqlVisibility?: 'VISIBLE' | 'INVISIBLE';
    include?: string[];
}
export type IndexInput = IndexOptions | IndexOptionsBuilder;
export declare function normalizeIndexOptions(input: IndexInput): IndexMetadata;
export declare function Index(options: IndexInput): (_target: unknown, context: ClassDecoratorContext) => void;
//# sourceMappingURL=index.d.ts.map