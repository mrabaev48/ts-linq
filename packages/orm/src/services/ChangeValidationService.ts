import { MetadataStorage } from '../../metadata/MetadataStorage';
import { ValidationError } from '../../types';
import type { AuditOptions } from '../../types';

type ChangeForValidation = {
  entity: Record<string, unknown>;
  entityClass: Function;
  state: string;
  originalValues?: object;
};

export class ChangeValidationService {
  private readonly translate?: (key: string, params?: Record<string, unknown>) => string;
  private readonly audit?: AuditOptions;
  private readonly rulesCache: WeakMap<
    Function,
    Array<{ propertyName: string; predicate: (e: unknown) => boolean; message?: string }>
  > = new WeakMap();

  constructor(
    translate?: (key: string, params?: Record<string, unknown>) => string,
    audit?: AuditOptions
  ) {
    this.translate = translate;
    this.audit = audit;
  }

  public validate(changes: ChangeForValidation[]): void {
    const errors: Array<{
      entity: string;
      property: string;
      message: string;
      entityClass?: string;
      table?: string;
      column?: string;
      fullMessage?: string;
    }> = [];

    for (const change of changes) {
      if (change.state !== 'added' && change.state !== 'modified') continue;
      const meta = MetadataStorage.getEntity(change.entityClass);
      if (!meta) continue;

      const auditCfg = this.audit?.enabled ? this.audit : undefined;
      const auditNames = this.extractAuditNames(auditCfg);

      for (const col of meta.columns) {
        this.validateComputedColumn(meta, col, change, errors);
        this.validateNullAndLength(meta, col, change, auditCfg, auditNames, errors);
      }
      this.runConditionalValidations(change, meta, errors);
    }

    if (errors.length > 0) throw new ValidationError('Model validation failed', errors);
  }

  private getValidationRules(
    entityClass: Function
  ): Array<{ propertyName: string; predicate: (e: unknown) => boolean; message?: string }> {
    const cached = this.rulesCache.get(entityClass);
    if (cached) return cached;
    // Stage-3: Use MetadataStorage instead of Reflect API
    const rules = MetadataStorage.getValidationRules(entityClass).slice();
    this.rulesCache.set(entityClass, rules);
    return rules;
  }

  private extractAuditNames(
    audit?: AuditOptions
  ): { createdAt: string; updatedAt: string; createdBy: string; updatedBy: string } | undefined {
    if (!audit) return undefined;
    return {
      createdAt: audit.timeColumns?.createdAt ?? 'createdAt',
      updatedAt: audit.timeColumns?.updatedAt ?? 'updatedAt',
      createdBy: audit.userColumns?.createdBy ?? 'createdBy',
      updatedBy: audit.userColumns?.updatedBy ?? 'updatedBy'
    };
  }

  private validateComputedColumn(
    meta: ReturnType<typeof MetadataStorage.getEntity>,
    col: { propertyName: string; isComputed?: boolean },
    change: {
      entity: Record<string, unknown>;
      state: string;
      originalValues?: object;
    },
    errors: Array<{ entity: string; property: string; message: string; fullMessage?: string }>
  ): void {
    if (!col.isComputed) return;
    const value = change.entity[col.propertyName];
    if (change.state === 'added') {
      if (value !== undefined)
        errors.push(
          this.buildValidationDetail(
            meta,
            col.propertyName,
            'Computed column is read-only and cannot be set on insert'
          )
        );
      return;
    }
    if (change.state === 'modified' && change.originalValues) {
      const prev = (change.originalValues as Record<string, unknown>)[col.propertyName];
      if (value !== prev)
        errors.push(
          this.buildValidationDetail(
            meta,
            col.propertyName,
            'Computed column is read-only and cannot be updated'
          )
        );
    }
  }

  private validateNullAndLength(
    meta: ReturnType<typeof MetadataStorage.getEntity>,
    col: {
      propertyName: string;
      isGenerated?: boolean;
      nullable?: boolean;
      length?: number;
      defaultValue?: unknown;
    },
    change: { entity: Record<string, unknown>; state: string },
    audit: AuditOptions | undefined,
    auditNames:
      | { createdAt: string; updatedAt: string; createdBy: string; updatedBy: string }
      | undefined,
    errors: Array<{ entity: string; property: string; message: string; fullMessage?: string }>
  ): void {
    const value = change.entity[col.propertyName];
    const isGeneratedPk = this.isGeneratedPrimaryKey(meta, col, change);
    const hasDbDefault = col.defaultValue !== undefined && change.state === 'added';
    const satisfiableByAudit = this.canBeSatisfiedByAudit(
      audit,
      auditNames,
      change.state,
      col.propertyName
    );
    if (
      !col.nullable &&
      (value === null || value === undefined) &&
      !isGeneratedPk &&
      !hasDbDefault &&
      !satisfiableByAudit
    ) {
      errors.push(this.buildValidationDetail(meta, col.propertyName, 'Value cannot be null'));
    }
    if (col.length && typeof value === 'string' && value.length > col.length) {
      errors.push(
        this.buildValidationDetail(meta, col.propertyName, `Length exceeds ${col.length}`)
      );
    }
  }

  private isGeneratedPrimaryKey(
    meta: ReturnType<typeof MetadataStorage.getEntity>,
    col: { propertyName: string; isGenerated?: boolean },
    change: { state: string }
  ): boolean {
    return (
      !!meta &&
      meta.primaryKeys.includes(col.propertyName) &&
      !!col.isGenerated &&
      change.state === 'added'
    );
  }

  private canBeSatisfiedByAudit(
    audit: AuditOptions | undefined,
    auditNames:
      | { createdAt: string; updatedAt: string; createdBy: string; updatedBy: string }
      | undefined,
    state: string,
    propertyName: string
  ): boolean {
    if (!audit || !auditNames) return false;
    if (
      state === 'added' &&
      (propertyName === auditNames.createdAt || propertyName === auditNames.createdBy)
    ) {
      return propertyName === auditNames.createdAt || audit.getCurrentUserId !== undefined;
    }
    if (
      (state === 'added' || state === 'modified') &&
      (propertyName === auditNames.updatedAt || propertyName === auditNames.updatedBy)
    ) {
      return propertyName === auditNames.updatedAt || audit.getCurrentUserId !== undefined;
    }
    return false;
  }

  private runConditionalValidations(
    change: { entity: Record<string, unknown>; entityClass: Function; state: string },
    meta: ReturnType<typeof MetadataStorage.getEntity>,
    errors: Array<{ entity: string; property: string; message: string; fullMessage?: string }>
  ): void {
    try {
      const rules = this.getValidationRules(change.entityClass);
      for (const rule of rules) {
        const phase = (rule as { phase?: 'onCreate' | 'onUpdate' | 'always' }).phase || 'always';
        if (phase === 'onCreate' && change.state !== 'added') continue;
        if (phase === 'onUpdate' && change.state !== 'modified') continue;
        const ok = !!rule.predicate(change.entity);
        if (!ok) {
          const msgKey = (rule as { messageKey?: string }).messageKey;
          const msgParams = (rule as { messageParams?: Record<string, unknown> }).messageParams;
          const translated =
            msgKey && this.translate ? this.translate(msgKey, msgParams) : undefined;
          const baseMsg = translated || rule.message || 'Validation rule failed';
          errors.push(this.buildValidationDetail(meta, rule.propertyName, baseMsg));
        }
      }
    } catch {
      /* ignore */
    }
  }

  private buildValidationDetail(
    meta: ReturnType<typeof MetadataStorage.getEntity>,
    property: string,
    message: string
  ): {
    entity: string;
    property: string;
    message: string;
    entityClass?: string;
    table?: string;
    column?: string;
    fullMessage?: string;
  } {
    const table = meta?.tableName || 'unknown_table';
    const typeName = meta?.target?.name || 'UnknownEntity';
    const col = meta?.columns.find((c: any) => c.propertyName === property)?.columnName || property;
    const fullMessage = `${typeName}.${property} (${table}.${col}): ${message}`;
    return {
      entity: table,
      property,
      message,
      entityClass: typeName,
      table,
      column: col,
      fullMessage
    };
  }
}
