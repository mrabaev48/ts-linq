/**
 * @ts-linq/plugin-multi-tenant
 *
 * Plugin for multi-tenant functionality in TypeScript ORM
 */

export { MultiTenantMiddleware } from './MultiTenantMiddleware';
export type {
  MultiTenantMiddleware as IMultiTenantMiddleware,
  MultiTenantOptions,
  TenantContext
} from './types';
export { createTenantScope, getTenantId, hasTenantColumn, setTenantId, withTenant } from './utils';
