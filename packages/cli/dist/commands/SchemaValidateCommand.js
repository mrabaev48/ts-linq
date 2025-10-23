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
exports.SchemaValidateCommand = void 0;
const path = __importStar(require("path"));
const migrations_1 = require("@ts-linq/migrations");
const utils_1 = require("../utils");
const ConsoleLogger_1 = require("../adapters/ConsoleLogger");
const NodeFs_1 = require("../adapters/NodeFs");
class SchemaValidateCommand {
    constructor(logger = new ConsoleLogger_1.ConsoleLogger(), fsAdapter = new NodeFs_1.NodeFs()) {
        this.logger = logger;
        this.fsAdapter = fsAdapter;
        this.name = 'schema:validate';
        this.describe = 'Validates that DB matches the snapshot';
        this.aliases = ['schema validate'];
    }
    async runDb(provider, argv) {
        const file = argv[1] || path.resolve(process.cwd(), 'schema.snapshot.json');
        if (!this.fsAdapter.exists(file)) {
            this.logger.error(`Snapshot file not found: ${file}`);
            process.exitCode = 2;
            return;
        }
        const target = new migrations_1.SchemaSnapshotSerializer().deserialize(this.fsAdapter.readText(file));
        const actual = await new migrations_1.SchemaSnapshotBuilder(provider).buildActualFromProvider(target);
        const diff = (0, migrations_1.compareSchemas)(target, actual);
        const rendered = (0, migrations_1.generateMigrationFromDiff)(diff, (0, utils_1.resolveDialect)(provider.providerLabel));
        if (rendered.up.length > 0) {
            this.logger.error(`Schema drift detected: ${rendered.up.length} change(s) required`);
            for (const sql of rendered.up)
                this.logger.error(sql);
            process.exitCode = 1;
        }
        else {
            this.logger.info('Schema validation: OK (no drift)');
        }
    }
}
exports.SchemaValidateCommand = SchemaValidateCommand;
//# sourceMappingURL=SchemaValidateCommand.js.map