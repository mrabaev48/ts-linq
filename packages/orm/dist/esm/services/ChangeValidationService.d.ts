import type { AuditOptions } from '@ts-linq/core';
type ChangeForValidation = {
    entity: Record<string, unknown>;
    entityClass: Function;
    state: string;
    originalValues?: object;
};
export declare class ChangeValidationService {
    private readonly translate?;
    private readonly audit?;
    private readonly rulesCache;
    constructor(translate?: (key: string, params?: Record<string, unknown>) => string, audit?: AuditOptions);
    validate(changes: ChangeForValidation[]): void;
    private getValidationRules;
    private extractAuditNames;
    private validateComputedColumn;
    private validateNullAndLength;
    private isGeneratedPrimaryKey;
    private canBeSatisfiedByAudit;
    private runConditionalValidations;
    private buildValidationDetail;
}
export {};
//# sourceMappingURL=ChangeValidationService.d.ts.map