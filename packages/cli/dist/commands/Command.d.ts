import type { DatabaseProvider } from '@ts-linq/core';
export interface Command {
    readonly name: string;
    readonly describe: string;
    readonly requiresProvider: boolean;
    readonly aliases?: string[];
    run(provider: DatabaseProvider | null, argv: string[]): Promise<void>;
}
//# sourceMappingURL=Command.d.ts.map