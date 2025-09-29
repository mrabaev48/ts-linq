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
exports.MigrationsRollbackCommand = void 0;
const path = __importStar(require("path"));
const core_1 = require("@ts-linq/core");
const ConsoleLogger_1 = require("../adapters/ConsoleLogger");
const NodeFs_1 = require("../adapters/NodeFs");
const config_1 = require("../config");
class MigrationsRollbackCommand {
    constructor(logger = new ConsoleLogger_1.ConsoleLogger(), fsAdapter = new NodeFs_1.NodeFs()) {
        this.logger = logger;
        this.fsAdapter = fsAdapter;
        this.name = 'migration:rollback';
        this.describe = 'Откатить последние миграции (--steps=N) или до версии (--to=YYYYMMDDHHmmss)';
        this.requiresProvider = true;
        this.aliases = ['migrations:rollback'];
    }
    async run(provider, argv) {
        if (!provider)
            throw new Error('Provider is required');
        // parse args: --steps=N or --to=version
        const stepsArg = argv.find((a) => a.startsWith('--steps='));
        const toArg = argv.find((a) => a.startsWith('--to='));
        const steps = stepsArg ? parseInt(stepsArg.split('=')[1] || '0', 10) : 0;
        const toVersion = toArg ? toArg.split('=')[1] : undefined;
        const cfg = ((0, config_1.tryLoadConfig)(process.cwd()) || {});
        const migrationsDir = path.resolve(process.cwd(), cfg.migrations || 'migrations');
        const loadAllMigrations = async () => {
            if (!this.fsAdapter.exists(migrationsDir))
                return [];
            const files = this.fsAdapter
                .readDir(migrationsDir)
                .filter((f) => /\.(ts|js|mjs|cjs)$/.test(f))
                .map((f) => path.join(migrationsDir, f));
            // register ts-node for .ts files at runtime if available
            if (files.some((f) => f.endsWith('.ts'))) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    require('ts-node/register/transpile-only');
                }
                catch {
                    // ignore if not available
                }
            }
            const mods = [];
            for (const file of files) {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const mod = require(file);
                mods.push(mod);
            }
            return mods;
        };
        const runner = new core_1.MigrationRunner(provider);
        const applied = await runner.getAppliedMigrations();
        // load migration classes from files and register in runner
        const modules = (await loadAllMigrations());
        for (const mod of modules) {
            for (const key of Object.keys(mod)) {
                const exported = mod[key];
                if (exported &&
                    typeof exported === 'function' &&
                    Object.prototype.hasOwnProperty.call(exported.prototype || {}, 'up') &&
                    Object.prototype.hasOwnProperty.call(exported.prototype || {}, 'down')) {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                        const Ctor = exported;
                        const instance = new Ctor();
                        if (typeof instance.getVersion === 'function') {
                            runner.addMigration(instance);
                        }
                    }
                    catch {
                        // ignore non-constructible exports
                    }
                }
            }
        }
        let targetVersion = toVersion;
        if (!targetVersion && steps > 0) {
            const sortedApplied = [...applied].sort((a, b) => a.version.localeCompare(b.version));
            const keepCount = Math.max(sortedApplied.length - steps, 0);
            targetVersion = keepCount > 0 ? sortedApplied[keepCount - 1].version : undefined;
        }
        this.logger.info(targetVersion
            ? `Rolling back to version ${targetVersion}...`
            : steps > 0
                ? `Rolling back ${steps} step(s)...`
                : 'Rolling back all applied migrations...');
        await runner.rollback(targetVersion);
        this.logger.info('Rollback completed');
    }
}
exports.MigrationsRollbackCommand = MigrationsRollbackCommand;
//# sourceMappingURL=MigrationsRollbackCommand.js.map