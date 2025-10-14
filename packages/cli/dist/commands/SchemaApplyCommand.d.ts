import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class SchemaApplyCommand implements DbCommand {
    private readonly logger;
    private readonly fsAdapter;
    readonly name = "schema:apply";
    readonly describe = "Applies snapshot differences to the database";
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem);
    runDb(provider: DatabaseProvider, argv: string[]): Promise<void>;
}
//# sourceMappingURL=SchemaApplyCommand.d.ts.map