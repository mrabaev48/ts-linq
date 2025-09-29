import type { DatabaseProvider } from '@ts-linq/core';
import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class MigrationsRollbackCommand implements Command {
    private readonly logger;
    private readonly fsAdapter;
    readonly name = "migration:rollback";
    readonly describe = "\u041E\u0442\u043A\u0430\u0442\u0438\u0442\u044C \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 \u043C\u0438\u0433\u0440\u0430\u0446\u0438\u0438 (--steps=N) \u0438\u043B\u0438 \u0434\u043E \u0432\u0435\u0440\u0441\u0438\u0438 (--to=YYYYMMDDHHmmss)";
    readonly requiresProvider = true;
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem);
    run(provider: DatabaseProvider | null, argv: string[]): Promise<void>;
}
//# sourceMappingURL=MigrationsRollbackCommand.d.ts.map