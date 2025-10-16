import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class MigrationsRollbackCommand implements DbCommand {
    private readonly logger;
    private readonly fsAdapter;
    readonly name = "migration:rollback";
    readonly describe = "Rollback last migrations (--steps=N) or to a version (--to=YYYYMMDDHHmmss)";
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem);
    runDb(provider: DatabaseProvider, argv: string[]): Promise<void>;
    private parseArgs;
    private resolveMigrationsDir;
    private loadAllMigrations;
    private tryRegisterTsNode;
    private requireModule;
    private registerModuleMigrations;
    private computeTargetVersion;
    private logRollbackTarget;
}
//# sourceMappingURL=MigrationsRollbackCommand.d.ts.map