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
exports.SchemaApplyCommand = void 0;
const path = __importStar(require("path"));
const core_1 = require("@ts-linq/core");
const core_2 = require("@ts-linq/core");
const utils_1 = require("../utils");
const ConsoleLogger_1 = require("../adapters/ConsoleLogger");
const NodeFs_1 = require("../adapters/NodeFs");
class SchemaApplyCommand {
    constructor(logger = new ConsoleLogger_1.ConsoleLogger(), fsAdapter = new NodeFs_1.NodeFs()) {
        this.logger = logger;
        this.fsAdapter = fsAdapter;
        this.name = 'schema:apply';
        this.describe = 'Applies snapshot differences to the database';
        this.aliases = ['schema apply'];
    }
    async runDb(provider, argv) {
        const file = argv[1] || path.resolve(process.cwd(), 'schema.snapshot.json');
        const dryRun = !!(0, utils_1.getFlag)(argv, 'dry-run');
        const force = !!(0, utils_1.getFlag)(argv, 'force');
        if (!this.fsAdapter.exists(file)) {
            this.logger.error(`Snapshot file not found: ${file}`);
            process.exitCode = 2;
            return;
        }
        const target = new core_1.SchemaSnapshotSerializer().deserialize(this.fsAdapter.readText(file));
        const actual = await new core_1.SchemaSnapshotBuilder(provider).buildActualFromProvider(target);
        const diff = (0, core_2.compareSchemas)(target, actual);
        const rendered = (0, core_1.generateMigrationFromDiff)(diff, (0, utils_1.resolveDialect)(provider.providerLabel));
        let applied = 0;
        for (const sql of rendered.up) {
            if (sql.trim().startsWith('--'))
                continue;
            const destructive = /\b(DROP|DELETE)\b/i.test(sql);
            if (dryRun) {
                this.logger.info(sql);
                continue;
            }
            if (destructive && !force) {
                this.logger.warn('Destructive change detected (DROP/DELETE). Re-run with --force to apply.');
                process.exitCode = 2;
                return;
            }
            // eslint-disable-next-line no-await-in-loop
            await provider.executeNonQuery(sql);
            applied++;
        }
        if (!dryRun)
            this.logger.info(`Applied ${applied} step(s) from snapshot`);
    }
}
exports.SchemaApplyCommand = SchemaApplyCommand;
//# sourceMappingURL=SchemaApplyCommand.js.map