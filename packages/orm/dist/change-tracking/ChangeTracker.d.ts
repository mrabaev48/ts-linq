import type { TrackedEntity } from '@ts-linq/core/dist/types';
import { EntityState } from '@ts-linq/core/dist/types';
export declare class ChangeTracker {
    private _trackedEntities;
    add<T extends object>(entity: T, entityClass: Function): void;
    update<T extends object>(entity: T, entityClass: Function): void;
    remove<T extends object>(entity: T, entityClass: Function): void;
    attach<T extends object>(entity: T, entityClass: Function): void;
    getChanges(): TrackedEntity[];
    getEntityState(entity: object): EntityState;
    acceptAllChanges(): void;
    clear(): void;
    detectChanges(): void;
    private cloneObject;
    private areObjectsEqual;
}
//# sourceMappingURL=ChangeTracker.d.ts.map