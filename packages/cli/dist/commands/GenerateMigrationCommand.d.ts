import type { DatabaseProvider } from '@ts-linq/core';
import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
import { MigrationTemplateBuilder } from '../generators/MigrationTemplateBuilder';
export declare class GenerateMigrationCommand implements Command {
    private readonly logger;
    private readonly fsAdapter;
    private readonly builder;
    readonly name = "generate:migration";
    readonly describe = "\u0421\u043E\u0437\u0434\u0430\u0451\u0442 \u0444\u0430\u0439\u043B \u043C\u0438\u0433\u0440\u0430\u0446\u0438\u0438 \u0441 \u0448\u0430\u0431\u043B\u043E\u043D\u043E\u043C";
    readonly requiresProvider = false;
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem, builder?: MigrationTemplateBuilder);
    run(_provider: DatabaseProvider | null, argv: string[]): Promise<void>;
}
//# sourceMappingURL=GenerateMigrationCommand.d.ts.map