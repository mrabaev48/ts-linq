import 'reflect-metadata';
import type { IndexMetadata } from '@ts-linq/types';
import { IndexOptionsBuilder } from '../utils/IndexOptionsBuilder';
export { IndexOptionsBuilder } from '../utils/IndexOptionsBuilder';
export { ValidIf, ValidIfOf, RequiredIfOf, MinLengthOf, MaxLengthOf, PatternOf, RangeOf } from './ValidIf';
export { Entity } from './Entity';
export { Column } from './Column';
export { PrimaryKey } from './PrimaryKey';
export { ManyToOne, OneToMany, OneToOne, ManyToMany } from './Relationships';
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
/**
 * Legacy class decorator that registers an index on the entity.
 * Uses reflect-metadata for metadata storage.
 */
export declare function Index(options: IndexInput): ClassDecorator;
//# sourceMappingURL=index.d.ts.map