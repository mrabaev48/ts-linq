export class UpdateCommand {
    constructor(provider, onAfterUpdate) {
        this.provider = provider;
        this.onAfterUpdate = onAfterUpdate;
    }
    async execute(change) {
        if (!change.entity || typeof change.entity !== 'object')
            return;
        await this.provider.update(change.entity, change.entityClass);
        this.onAfterUpdate(change);
    }
}
//# sourceMappingURL=UpdateCommand.js.map