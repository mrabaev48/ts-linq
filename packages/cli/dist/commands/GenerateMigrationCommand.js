"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateMigrationCommand = void 0;
const path = __importStar(require("path"));
const ConsoleLogger_1 = require("../adapters/ConsoleLogger");
const NodeFs_1 = require("../adapters/NodeFs");
const MigrationTemplateBuilder_1 = require("../generators/MigrationTemplateBuilder");
class GenerateMigrationCommand {
    constructor(logger = new ConsoleLogger_1.ConsoleLogger(), fsAdapter = new NodeFs_1.NodeFs(), builder = new MigrationTemplateBuilder_1.MigrationTemplateBuilder()) {
        this.logger = logger;
        this.fsAdapter = fsAdapter;
        this.builder = builder;
        this.name = 'generate:migration';
        this.describe = 'Creates a migration file from a template';
        this.aliases = ['generate migration'];
    }
    run(argv) {
        const name = (argv[2] && argv[1] !== 'entity' ? argv[2] : argv[1] || 'Migration').replace(/\s+/g, '_');
        const ts = new Date()
            .toISOString()
            .replace(/[-:TZ.]/g, '')
            .slice(0, 14);
        const dir = path.resolve(process.cwd(), 'migrations');
        this.fsAdapter.ensureDir(dir);
        const file = path.join(dir, `${ts}_${name}.ts`);
        const template = this.builder.build(name, ts);
        this.fsAdapter.writeText(file, template);
        this.logger.info(`Created ${file}`);
        return Promise.resolve();
    }
}
exports.GenerateMigrationCommand = GenerateMigrationCommand;
//# sourceMappingURL=GenerateMigrationCommand.js.map