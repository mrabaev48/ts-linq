export * from './builtins/BoolToZeroOneConverter';
export * from './builtins/DateOnlyToStringConverter';
export * from './builtins/EnumToNumberConverter';
export * from './builtins/EnumToStringConverter';
export * from './Column';
export * from './Entity';
export * from './EntityMetadata';
export * from './MetadataRegistry';
export * from './MetadataStorage';
export * from './PendingMetadataCollector';
export * from './PrimaryKey';
export { reflectGetOwnMetadata } from './reflectUtils';
export * from './Relationships';
export * from './resolveEntityRef';
export * from './ValidIf';
export * from './ValueComparer';
export * from './ValueConverter';
export { DeleteBehavior, type ValueComparerLike, type ValueConverterLike } from '@ts-linq/types';

import { MetadataRegistry } from './MetadataRegistry';

/** Creates a new, empty `MetadataRegistry` instance. Use for test isolation or multi-tenant setups. */
export function createMetadataRegistry(): MetadataRegistry {
  return new MetadataRegistry();
}
