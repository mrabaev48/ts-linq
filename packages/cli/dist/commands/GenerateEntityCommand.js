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
exports.GenerateEntityCommand = void 0;
const path = __importStar(require("path"));
const ConsoleLogger_1 = require("../adapters/ConsoleLogger");
const NodeFs_1 = require("../adapters/NodeFs");
const utils_1 = require("../utils");
const schema_inspect_1 = require("../schema-inspect");
const EntityTemplateBuilder_1 = require("../generators/EntityTemplateBuilder");
const ArgReader_1 = require("../services/ArgReader");
class GenerateEntityCommand {
    constructor(logger = new ConsoleLogger_1.ConsoleLogger(), fsAdapter = new NodeFs_1.NodeFs(), template = new EntityTemplateBuilder_1.EntityTemplateBuilder()) {
        this.logger = logger;
        this.fsAdapter = fsAdapter;
        this.template = template;
        this.name = 'generate:entity';
        this.describe = 'Generates an entity from a name or from a table';
        this.aliases = ['generate entity'];
    }
    async runDb(provider, argv) {
        const args = new ArgReader_1.ArgReader(argv);
        const rawName = (argv[2] || '').trim();
        if (!rawName) {
            this.logger.error('Usage: ts-linq generate entity <Name> [--table users] [--dir src/entities]');
            process.exitCode = 2;
            return;
        }
        const toPascal = (s) => s
            .replace(/[-_\s]+/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
            .join('');
        const entityName = toPascal(rawName);
        const outDir = args.flag('dir') || path.join('src', 'entities');
        const table = args.flag('table') || `${entityName.toLowerCase()}s`;
        const fromTable = args.flag('from-table') || undefined;
        const schema = args.flag('schema') || undefined;
        const destDir = path.resolve(process.cwd(), outDir);
        (0, utils_1.ensureDir)(destDir);
        const destFile = path.join(destDir, `${entityName}.ts`);
        let tpl;
        if (fromTable) {
            const label = (0, utils_1.resolveDialect)(provider.providerLabel);
            const defs = await (0, schema_inspect_1.inspectTable)(provider, label, fromTable, schema);
            tpl = this.template.buildFromColumns(entityName, fromTable, defs);
        }
        else {
            tpl = this.template.buildDefault(entityName, table);
        }
        if (this.fsAdapter.exists(destFile)) {
            this.logger.error(`Entity already exists: ${destFile}`);
            process.exitCode = 2;
            return;
        }
        this.fsAdapter.writeText(destFile, tpl);
        this.logger.info(`Created entity ${entityName} at ${destFile}`);
    }
}
exports.GenerateEntityCommand = GenerateEntityCommand;
//# sourceMappingURL=GenerateEntityCommand.js.map