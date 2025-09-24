import type { SchemaSnapshot } from './DiffTypes';
import type { DatabaseProvider } from '../DatabaseProvider';
/**
 * OOP builders/serializers for SchemaSnapshot with thin functional wrappers for back-compat.
 */
export declare class SchemaSnapshotBuilder {
    private readonly provider?;
    constructor(provider?: DatabaseProvider);
    buildExpectedFromMetadata(): SchemaSnapshot;
    buildActualFromProvider(expected?: SchemaSnapshot): Promise<SchemaSnapshot>;
    private mapPortableType;
    private normalizePortableType;
}
export declare class SchemaSnapshotSerializer {
    serialize(snapshot: SchemaSnapshot): string;
    deserialize(jsonText: string): SchemaSnapshot;
    private assertValid;
}
export declare function buildExpectedSchemaFromMetadata(): SchemaSnapshot;
export declare function buildActualSchemaFromProvider(provider: DatabaseProvider, expected?: SchemaSnapshot): Promise<SchemaSnapshot>;
export declare function serializeSchemaSnapshot(snapshot: SchemaSnapshot): string;
export declare function deserializeSchemaSnapshot(jsonText: string): SchemaSnapshot;
//# sourceMappingURL=SchemaSnapshot.d.ts.map