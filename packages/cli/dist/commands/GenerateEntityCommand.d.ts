import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
import { EntityTemplateBuilder } from '../generators/EntityTemplateBuilder';
export declare class GenerateEntityCommand implements DbCommand {
    private readonly logger;
    private readonly fsAdapter;
    private readonly template;
    readonly name = "generate:entity";
    readonly describe = "Generates an entity from a name or from a table";
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem, template?: EntityTemplateBuilder);
    runDb(provider: DatabaseProvider, argv: string[]): Promise<void>;
}
//# sourceMappingURL=GenerateEntityCommand.d.ts.map