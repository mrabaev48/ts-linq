import type { SchemaSnapshot } from '../DiffTypes';
export declare class StepPlanner {
    plan(expected: SchemaSnapshot, actual: SchemaSnapshot, dialect: 'sqlite' | 'postgresql' | 'mysql' | 'mssql'): string[];
}
//# sourceMappingURL=StepPlanner.d.ts.map