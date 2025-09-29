import type { Command } from './commands/Command';
export declare class CommandRegistry {
    private readonly nameToCommand;
    private readonly primary;
    constructor(commands: Command[]);
    get(name: string | undefined): Command | undefined;
    listNames(): string[];
    listCatalog(): Array<{
        name: string;
        describe: string;
        aliases?: string[];
    }>;
}
//# sourceMappingURL=CommandRegistry.d.ts.map