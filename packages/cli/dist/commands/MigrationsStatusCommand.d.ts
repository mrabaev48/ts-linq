import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class MigrationsStatusCommand implements DbCommand {
    private readonly logger;
    private readonly fsAdapter;
    readonly name = "migration:status";
    readonly describe = "Shows status of applied/pending migrations";
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem);
    runDb(provider: DatabaseProvider, _argv: string[]): Promise<void>;
}
//# sourceMappingURL=MigrationsStatusCommand.d.ts.map