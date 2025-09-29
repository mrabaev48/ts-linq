"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvProviderFactory = void 0;
const provider_factory_1 = require("../provider-factory");
class EnvProviderFactory {
    create() {
        return (0, provider_factory_1.createProviderFromEnv)();
    }
}
exports.EnvProviderFactory = EnvProviderFactory;
//# sourceMappingURL=EnvProviderFactory.js.map