import type { EntityCtorRef } from '@ts-linq/types';
export interface AuditColumnNames {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface NormalizedChange {
  entity: Record<string, unknown>;
  entityClass: EntityCtorRef;
  state: string;
  originalValues?: object;
}

export interface ValidationErrorDetail {
  entity: string;
  property: string;
  message: string;
  entityClass?: string;
  table?: string;
  column?: string;
  fullMessage?: string;
}
