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
exports.MigrationsStatusCommand = void 0;
const path = __importStar(require("path"));
const core_1 = require("@ts-linq/core");
const config_1 = require("../config");
const ConsoleLogger_1 = require("../adapters/ConsoleLogger");
const NodeFs_1 = require("../adapters/NodeFs");
class MigrationsStatusCommand {
    constructor(logger = new ConsoleLogger_1.ConsoleLogger(), fsAdapter = new NodeFs_1.NodeFs()) {
        this.logger = logger;
        this.fsAdapter = fsAdapter;
        this.name = 'migration:status';
        this.describe = 'Показывает статус применённых/ожидающих миграций';
        this.aliases = ['migrations:status'];
    }
    async runDb(provider, _argv) {
        const cfg = ((0, config_1.tryLoadConfig)(process.cwd()) || {});
        const migrationsDir = path.resolve(process.cwd(), cfg.migrations || 'migrations');
        const listLocal = () => {
            if (!this.fsAdapter.exists(migrationsDir))
                return [];
            const files = this.fsAdapter.readDir(migrationsDir);
            const res = [];
            for (const f of files) {
                const m = /^(\d{14})_(.+)\.(?:ts|js|cjs|mjs)$/.exec(f);
                if (m)
                    res.push({ version: m[1], name: m[2], file: path.join(migrationsDir, f) });
            }
            res.sort((a, b) => a.version.localeCompare(b.version));
            return res;
        };
        const runner = new core_1.MigrationRunner(provider);
        const applied = await runner.getAppliedMigrations();
        const local = listLocal();
        const appliedSet = new Set(applied.map((a) => a.version));
        const pending = local.filter((l) => !appliedSet.has(l.version));
        this.logger.info(`Migrations directory: ${migrationsDir}`);
        this.logger.info(`Applied: ${applied.length}`);
        for (const a of applied)
            this.logger.info(`  ${a.version}  ${a.name}`);
        this.logger.info(`Pending: ${pending.length}`);
        for (const p of pending)
            this.logger.info(`  ${p.version}  ${p.name}`);
    }
}
exports.MigrationsStatusCommand = MigrationsStatusCommand;
//# sourceMappingURL=MigrationsStatusCommand.js.map