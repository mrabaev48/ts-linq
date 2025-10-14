import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class SchemaValidateCommand implements DbCommand {
    private readonly logger;
    private readonly fsAdapter;
    readonly name = "schema:validate";
    readonly describe = "Validates that DB matches the snapshot";
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem);
    runDb(provider: DatabaseProvider, argv: string[]): Promise<void>;
}
//# sourceMappingURL=SchemaValidateCommand.d.ts.map