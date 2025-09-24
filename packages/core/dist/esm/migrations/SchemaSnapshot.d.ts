import type { SchemaSnapshot } from './DiffTypes';
import type { DatabaseProvider } from '../DatabaseProvider';
export declare function buildExpectedSchemaFromMetadata(): SchemaSnapshot;
export declare function buildActualSchemaFromProvider(provider: DatabaseProvider, expected?: SchemaSnapshot): Promise<SchemaSnapshot>;
export declare function serializeSchemaSnapshot(snapshot: SchemaSnapshot): string;
export declare function deserializeSchemaSnapshot(jsonText: string): SchemaSnapshot;
//# sourceMappingURL=SchemaSnapshot.d.ts.map