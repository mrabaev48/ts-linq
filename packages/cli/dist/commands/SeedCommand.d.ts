import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class SeedCommand implements DbCommand {
    private readonly logger;
    private readonly fsAdapter;
    readonly name = "seed";
    readonly describe = "Executes SQL from a file to seed initial data";
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem);
    runDb(provider: DatabaseProvider, argv: string[]): Promise<void>;
}
//# sourceMappingURL=SeedCommand.d.ts.map