/**
 * @ts-linq/plugin-multi-tenant
 * 
 * Plugin for multi-tenant functionality in TypeScript ORM
 */

export { MultiTenantMiddleware } from './MultiTenantMiddleware';
export { 
  withTenant, 
  createTenantScope,
  getTenantId,
  hasTenantColumn,
  setTenantId
} from './utils';

export type {
  MultiTenantOptions,
  TenantContext,
  MultiTenantMiddleware as IMultiTenantMiddleware
} from './types';
