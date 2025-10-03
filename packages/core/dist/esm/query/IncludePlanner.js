import { LoadingStrategy } from '../loading/LoadingStrategy';
export class IncludePlanner {
    constructor(entityLoader, entityClass) {
        this.entityLoader = entityLoader;
        this.entityClass = entityClass;
    }
    async populateIncludes(entities, includes, limit) {
        if (!this.entityLoader || includes.length === 0 || limit === 1)
            return;
        await this.entityLoader.populateRelationshipsMany(entities, this.entityClass, {
            strategy: LoadingStrategy.Eager,
            includes,
            depth: 1
        });
    }
}
//# sourceMappingURL=IncludePlanner.js.map