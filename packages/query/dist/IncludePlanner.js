"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncludePlanner = void 0;
class IncludePlanner {
    constructor(entityLoader, entityClass) {
        this.entityLoader = entityLoader;
        this.entityClass = entityClass;
    }
    async populateIncludes(entities, includes, limit) {
        if (!this.entityLoader || includes.length === 0 || limit === 1)
            return;
        await this.entityLoader.populateRelationshipsMany(entities, this.entityClass, {
            strategy: 'eager',
            includes,
            depth: 1
        });
    }
}
exports.IncludePlanner = IncludePlanner;
//# sourceMappingURL=IncludePlanner.js.map