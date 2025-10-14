import type { Command } from './Command';
export declare class InitCommand implements Command {
    readonly name = "init";
    readonly describe = "Initialize a project with ts-linq skeleton";
    run(argv: string[]): Promise<void>;
}
//# sourceMappingURL=InitCommand.d.ts.map