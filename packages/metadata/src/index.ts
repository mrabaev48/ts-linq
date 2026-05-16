export * from './MetadataRegistry';
export * from './MetadataStorage';
export * from './PendingMetadataCollector';
export * from './EntityMetadata';
export * from './Entity';
export * from './Column';
export * from './PrimaryKey';
export * from './Relationships';
export * from './ValidIf';
export { reflectGetOwnMetadata } from './reflectUtils';

import { MetadataRegistry } from './MetadataRegistry';

/** Creates a new, empty `MetadataRegistry` instance. Use for test isolation or multi-tenant setups. */
export function createMetadataRegistry(): MetadataRegistry {
  return new MetadataRegistry();
}
