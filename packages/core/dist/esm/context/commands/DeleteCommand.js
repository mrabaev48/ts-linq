export class DeleteCommand {
    constructor(provider, handleSoftDelete, onAfterDelete) {
        this.provider = provider;
        this.handleSoftDelete = handleSoftDelete;
        this.onAfterDelete = onAfterDelete;
    }
    async execute(change) {
        if (await this.handleSoftDelete(change))
            return true;
        await this.provider.delete(change.entity, change.entityClass);
        this.onAfterDelete(change);
        return true;
    }
}
//# sourceMappingURL=DeleteCommand.js.map