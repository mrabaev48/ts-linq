/**
 * @ts-linq/plugin-soft-delete
 *
 * Plugin for soft delete functionality in TypeScript ORM
 */

export { SoftDeleteMiddleware } from './SoftDeleteMiddleware';
export type {
  SoftDeleteMiddleware as ISoftDeleteMiddleware,
  SoftDeleteContext,
  SoftDeleteOptions
} from './types';
export {
  isMarkedForHardDelete,
  isSoftDeleted,
  markForHardDelete,
  restore,
  withSoftDelete
} from './utils';
