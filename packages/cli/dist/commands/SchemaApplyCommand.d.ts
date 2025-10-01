import type { DatabaseProvider } from '@ts-linq/core';
import type { DbCommand } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class SchemaApplyCommand implements DbCommand {
    private readonly logger;
    private readonly fsAdapter;
    readonly name = "schema:apply";
    readonly describe = "\u041F\u0440\u0438\u043C\u0435\u043D\u044F\u0435\u0442 \u043E\u0442\u043B\u0438\u0447\u0438\u044F snapshot \u043A \u0411\u0414";
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem);
    runDb(provider: DatabaseProvider, argv: string[]): Promise<void>;
}
//# sourceMappingURL=SchemaApplyCommand.d.ts.map