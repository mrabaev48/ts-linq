'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.UpdateCommand = void 0;
class UpdateCommand {
  constructor(provider, onAfterUpdate) {
    this.provider = provider;
    this.onAfterUpdate = onAfterUpdate;
  }
  async execute(change) {
    if (!change.entity || typeof change.entity !== 'object') return;
    await this.provider.update(change.entity, change.entityClass);
    this.onAfterUpdate(change);
  }
}
exports.UpdateCommand = UpdateCommand;
//# sourceMappingURL=UpdateCommand.js.map
