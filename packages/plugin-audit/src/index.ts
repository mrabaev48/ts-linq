/**
 * @ts-linq/plugin-audit
 *
 * Plugin for audit trail functionality in TypeScript ORM
 */

export { AuditMiddleware } from './AuditMiddleware';
export type { AuditContext, AuditOptions, AuditMiddleware as IAuditMiddleware } from './types';
export { getAuditInfo, hasBeenModified, timeSinceUpdate, withAudit } from './utils';
