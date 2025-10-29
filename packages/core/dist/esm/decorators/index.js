import 'reflect-metadata';
import { MetadataStorage } from '@ts-linq/metadata';
import { IndexOptionsBuilder } from '../utils/IndexOptionsBuilder';
// Re-export all decorators
export { IndexOptionsBuilder } from '../utils/IndexOptionsBuilder';
export { ValidIf, ValidIfOf, RequiredIfOf, MinLengthOf, MaxLengthOf, PatternOf, RangeOf } from './ValidIf';
export { Entity } from './Entity';
export { Column } from './Column';
export { PrimaryKey } from './PrimaryKey';
export { ManyToOne, OneToMany, OneToOne, ManyToMany } from './Relationships';
export function normalizeIndexOptions(input) {
    const built = input instanceof IndexOptionsBuilder
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
export function Index(options) {
    return function (target) {
        const ctor = target;
        const meta = normalizeIndexOptions(options);
        MetadataStorage.addIndex(ctor, meta);
        return target;
    };
}
//# sourceMappingURL=index.js.map