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
exports.GenerateEntitiesCommand = void 0;
const path = __importStar(require("path"));
const ConsoleLogger_1 = require("../adapters/ConsoleLogger");
const NodeFs_1 = require("../adapters/NodeFs");
const utils_1 = require("../utils");
const schema_inspect_1 = require("../schema-inspect");
const EntityTemplateBuilder_1 = require("../generators/EntityTemplateBuilder");
const ArgReader_1 = require("../services/ArgReader");
class GenerateEntitiesCommand {
    constructor(logger = new ConsoleLogger_1.ConsoleLogger(), fsAdapter = new NodeFs_1.NodeFs(), template = new EntityTemplateBuilder_1.EntityTemplateBuilder()) {
        this.logger = logger;
        this.fsAdapter = fsAdapter;
        this.template = template;
        this.name = 'generate:entities';
        this.describe = 'Generates entities for all tables of the schema';
        this.aliases = ['generate entities'];
    }
    async runDb(provider, argv) {
        const args = new ArgReader_1.ArgReader(argv);
        const outDir = args.flag('dir') || path.join('src', 'entities');
        const schema = args.flag('schema') || undefined;
        const label = (0, utils_1.resolveDialect)(provider.providerLabel);
        const destDir = path.resolve(process.cwd(), outDir);
        (0, utils_1.ensureDir)(destDir);
        const tables = await (0, schema_inspect_1.listAllTables)(provider, label, schema);
        if (tables.length === 0) {
            this.logger.info('No tables found to generate entities.');
            return;
        }
        for (const tbl of tables) {
            // eslint-disable-next-line no-await-in-loop
            const cols = await (0, schema_inspect_1.inspectTable)(provider, label, tbl, schema);
            const entityName = tbl
                .replace(/[^a-zA-Z0-9_]/g, ' ')
                .split(/\s+/)
                .filter(Boolean)
                .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                .join('');
            const destFile = path.join(destDir, `${entityName}.ts`);
            if (this.fsAdapter.exists(destFile))
                continue;
            const tpl = this.template.buildFromColumns(entityName, tbl, cols);
            this.fsAdapter.writeText(destFile, tpl);
            this.logger.info(`Created entity ${entityName} for table '${tbl}' at ${destFile}`);
        }
    }
}
exports.GenerateEntitiesCommand = GenerateEntitiesCommand;
//# sourceMappingURL=GenerateEntitiesCommand.js.map