import type { DatabaseProvider } from '@ts-linq/core';
import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
import { EntityTemplateBuilder } from '../generators/EntityTemplateBuilder';
export declare class GenerateEntityCommand implements Command {
    private readonly logger;
    private readonly fsAdapter;
    private readonly template;
    readonly name = "generate:entity";
    readonly describe = "\u0413\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0435\u0442 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C \u0438\u0437 \u0438\u043C\u0435\u043D\u0438 \u0438\u043B\u0438 \u0438\u0437 \u0442\u0430\u0431\u043B\u0438\u0446\u044B";
    readonly requiresProvider = true;
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem, template?: EntityTemplateBuilder);
    run(provider: DatabaseProvider | null, argv: string[]): Promise<void>;
}
//# sourceMappingURL=GenerateEntityCommand.d.ts.map