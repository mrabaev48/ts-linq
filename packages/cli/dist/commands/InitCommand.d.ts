import type { DatabaseProvider } from '@ts-linq/core';
import type { Command } from './Command';
export declare class InitCommand implements Command {
    readonly name = "init";
    readonly describe = "\u0418\u043D\u0438\u0446\u0438\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0441\u043E \u0441\u043A\u0435\u043B\u0435\u0442\u043E\u043C ts-linq";
    readonly requiresProvider = false;
    run(_provider: DatabaseProvider | null, argv: string[]): Promise<void>;
}
//# sourceMappingURL=InitCommand.d.ts.map