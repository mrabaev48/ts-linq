import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class SchemaDiffCommand implements DbCommand {
    private readonly logger;
    private readonly fsAdapter;
    readonly name = "schema:diff";
    readonly describe = "Prints SQL differences between snapshot and actual schema";
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem);
    runDb(provider: DatabaseProvider, argv: string[]): Promise<void>;
}
//# sourceMappingURL=SchemaDiffCommand.d.ts.map