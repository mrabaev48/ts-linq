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
export { DeleteBehavior } from '@ts-linq/types';

import { MetadataRegistry } from './MetadataRegistry';

/** Creates a new, empty `MetadataRegistry` instance. Use for test isolation or multi-tenant setups. */
export function createMetadataRegistry(): MetadataRegistry {
  return new MetadataRegistry();
}
