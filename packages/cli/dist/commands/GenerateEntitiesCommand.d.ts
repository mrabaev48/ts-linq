import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
import { EntityTemplateBuilder } from '../generators/EntityTemplateBuilder';
export declare class GenerateEntitiesCommand implements DbCommand {
    private readonly logger;
    private readonly fsAdapter;
    private readonly template;
    readonly name = "generate:entities";
    readonly describe = "Generates entities for all tables of the schema";
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem, template?: EntityTemplateBuilder);
    runDb(provider: DatabaseProvider, argv: string[]): Promise<void>;
}
//# sourceMappingURL=GenerateEntitiesCommand.d.ts.map