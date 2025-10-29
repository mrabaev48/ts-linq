"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteCommand = void 0;
class DeleteCommand {
    constructor(provider, handleSoftDelete, onAfterDelete) {
        this.provider = provider;
        this.handleSoftDelete = handleSoftDelete;
        this.onAfterDelete = onAfterDelete;
    }
    async execute(change) {
        if (!change.entity || typeof change.entity !== 'object')
            return false;
        const softDeleted = await this.handleSoftDelete(change);
        if (softDeleted) {
            this.onAfterDelete(change);
            return true;
        }
        await this.provider.delete(change.entity, change.entityClass);
        this.onAfterDelete(change);
        return true;
    }
}
exports.DeleteCommand = DeleteCommand;
//# sourceMappingURL=DeleteCommand.js.map