import type { DatabaseProvider } from '@ts-linq/core';
import type { SchemaSnapshot } from '../DiffTypes';
export declare class SchemaInspectionService {
    buildActualSnapshot(provider: DatabaseProvider, expected: SchemaSnapshot): Promise<SchemaSnapshot>;
    private normalizeType;
}
//# sourceMappingURL=SchemaInspectionService.d.ts.map