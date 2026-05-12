/**
 * @ts-linq/plugin-soft-delete
 * 
 * Plugin for soft delete functionality in TypeScript ORM
 */

export { SoftDeleteMiddleware } from './SoftDeleteMiddleware';
export { 
  withSoftDelete, 
  restore, 
  isSoftDeleted,
  markForHardDelete,
  isMarkedForHardDelete
} from './utils';

export type {
  SoftDeleteOptions,
  SoftDeleteContext,
  SoftDeleteMiddleware as ISoftDeleteMiddleware
} from './types';
