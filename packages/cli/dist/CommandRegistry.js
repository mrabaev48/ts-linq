'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.CommandRegistry = void 0;
class CommandRegistry {
  constructor(commands) {
    this.primary = commands;
    const map = {};
    for (const c of commands) {
      map[c.name] = c;
      if (c.aliases) {
        for (const a of c.aliases) map[a] = c;
      }
    }
    this.nameToCommand = map;
  }
  get(name) {
    if (!name) return undefined;
    return this.nameToCommand[name];
  }
  listNames() {
    return Object.keys(this.nameToCommand);
  }
  listCatalog() {
    return this.primary.map((c) => ({ name: c.name, describe: c.describe, aliases: c.aliases }));
  }
}
exports.CommandRegistry = CommandRegistry;
//# sourceMappingURL=CommandRegistry.js.map
