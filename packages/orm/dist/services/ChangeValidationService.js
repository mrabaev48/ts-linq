"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeValidationService = void 0;
const metadata_1 = require("@ts-linq/metadata");
const types_1 = require("@ts-linq/types");
class ChangeValidationService {
    constructor(translate, audit) {
        this.rulesCache = new WeakMap();
        this.translate = translate;
        this.audit = audit;
    }
    validate(changes) {
        const errors = [];
        for (const change of changes) {
            if (change.state !== 'added' && change.state !== 'modified')
                continue;
            const meta = metadata_1.MetadataStorage.getEntity(change.entityClass);
            if (!meta)
                continue;
            const auditCfg = this.audit?.enabled ? this.audit : undefined;
            const auditNames = this.extractAuditNames(auditCfg);
            for (const col of meta.columns) {
                this.validateComputedColumn(meta, col, change, errors);
                this.validateNullAndLength(meta, col, change, auditCfg, auditNames, errors);
            }
            this.runConditionalValidations(change, meta, errors);
        }
        if (errors.length > 0) {
            const error = new types_1.ValidationError('Model validation failed');
            error.errors = errors;
            throw error;
        }
    }
    getValidationRules(entityClass) {
        const cached = this.rulesCache.get(entityClass);
        if (cached)
            return cached;
        // Stage-3: Use MetadataStorage instead of Reflect API
        const rules = metadata_1.MetadataStorage.getValidationRules(entityClass).slice();
        this.rulesCache.set(entityClass, rules);
        return rules;
    }
    extractAuditNames(audit) {
        if (!audit)
            return undefined;
        return {
            createdAt: audit.timeColumns?.createdAt ?? 'createdAt',
            updatedAt: audit.timeColumns?.updatedAt ?? 'updatedAt',
            createdBy: audit.userColumns?.createdBy ?? 'createdBy',
            updatedBy: audit.userColumns?.updatedBy ?? 'updatedBy'
        };
    }
    validateComputedColumn(meta, col, change, errors) {
        if (!col.isComputed)
            return;
        const value = change.entity[col.propertyName];
        if (change.state === 'added') {
            if (value !== undefined)
                errors.push(this.buildValidationDetail(meta, col.propertyName, 'Computed column is read-only and cannot be set on insert'));
            return;
        }
        if (change.state === 'modified' && change.originalValues) {
            const prev = change.originalValues[col.propertyName];
            if (value !== prev)
                errors.push(this.buildValidationDetail(meta, col.propertyName, 'Computed column is read-only and cannot be updated'));
        }
    }
    validateNullAndLength(meta, col, change, audit, auditNames, errors) {
        const value = change.entity[col.propertyName];
        const isGeneratedPk = this.isGeneratedPrimaryKey(meta, col, change);
        const hasDbDefault = col.defaultValue !== undefined && change.state === 'added';
        const satisfiableByAudit = this.canBeSatisfiedByAudit(audit, auditNames, change.state, col.propertyName);
        if (!col.nullable &&
            (value === null || value === undefined) &&
            !isGeneratedPk &&
            !hasDbDefault &&
            !satisfiableByAudit) {
            errors.push(this.buildValidationDetail(meta, col.propertyName, 'Value cannot be null'));
        }
        if (col.length && typeof value === 'string' && value.length > col.length) {
            errors.push(this.buildValidationDetail(meta, col.propertyName, `Length exceeds ${col.length}`));
        }
    }
    isGeneratedPrimaryKey(meta, col, change) {
        return (!!meta &&
            !!meta.primaryKeys &&
            meta.primaryKeys.includes(col.propertyName) &&
            !!col.isGenerated &&
            change.state === 'added');
    }
    canBeSatisfiedByAudit(audit, auditNames, state, propertyName) {
        if (!audit || !auditNames)
            return false;
        if (state === 'added' &&
            (propertyName === auditNames.createdAt || propertyName === auditNames.createdBy)) {
            return propertyName === auditNames.createdAt || audit.getCurrentUserId !== undefined;
        }
        if ((state === 'added' || state === 'modified') &&
            (propertyName === auditNames.updatedAt || propertyName === auditNames.updatedBy)) {
            return propertyName === auditNames.updatedAt || audit.getCurrentUserId !== undefined;
        }
        return false;
    }
    runConditionalValidations(change, meta, errors) {
        try {
            const rules = this.getValidationRules(change.entityClass);
            for (const rule of rules) {
                const phase = rule.phase || 'always';
                if (phase === 'onCreate' && change.state !== 'added')
                    continue;
                if (phase === 'onUpdate' && change.state !== 'modified')
                    continue;
                const ok = !!rule.predicate(change.entity);
                if (!ok) {
                    const msgKey = rule.messageKey;
                    const msgParams = rule.messageParams;
                    const translated = msgKey && this.translate ? this.translate(msgKey, msgParams) : undefined;
                    const baseMsg = translated || rule.message || 'Validation rule failed';
                    errors.push(this.buildValidationDetail(meta, rule.propertyName, baseMsg));
                }
            }
        }
        catch {
            /* ignore */
        }
    }
    buildValidationDetail(meta, property, message) {
        const table = meta?.tableName || 'unknown_table';
        const typeName = meta?.target?.name || 'UnknownEntity';
        const col = meta?.columns.find((c) => c.propertyName === property)?.columnName || property;
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
exports.ChangeValidationService = ChangeValidationService;
//# sourceMappingURL=ChangeValidationService.js.map