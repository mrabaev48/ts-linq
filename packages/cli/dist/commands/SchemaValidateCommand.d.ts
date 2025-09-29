import type { DatabaseProvider } from '@ts-linq/core';
import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class SchemaValidateCommand implements Command {
    private readonly logger;
    private readonly fsAdapter;
    readonly name = "schema:validate";
    readonly describe = "\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u0442, \u0447\u0442\u043E \u0411\u0414 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 snapshot";
    readonly requiresProvider = true;
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem);
    run(provider: DatabaseProvider | null, argv: string[]): Promise<void>;
}
//# sourceMappingURL=SchemaValidateCommand.d.ts.map