"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsertCommand = void 0;
class InsertCommand {
    constructor(provider, onAfterInsert) {
        this.provider = provider;
        this.onAfterInsert = onAfterInsert;
    }
    async execute(change) {
        if (!change.entity || typeof change.entity !== 'object')
            return;
        await this.provider.insert(change.entity, change.entityClass);
        this.onAfterInsert(change);
    }
}
exports.InsertCommand = InsertCommand;
//# sourceMappingURL=InsertCommand.js.map