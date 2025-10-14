import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class MigrationsDryRunCommand implements DbCommand {
    private readonly logger;
    private readonly fsAdapter;
    readonly name = "migration:dry-run";
    readonly describe = "Prints SQL changes between snapshot and DB (dry-run)";
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem);
    runDb(provider: DatabaseProvider, argv: string[]): Promise<void>;
}
//# sourceMappingURL=MigrationsDryRunCommand.d.ts.map