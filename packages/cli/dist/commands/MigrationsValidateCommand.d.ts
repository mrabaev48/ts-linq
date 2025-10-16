import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class MigrationsValidateCommand implements Command {
    private readonly logger;
    private readonly fsAdapter;
    readonly name = "migration:validate";
    readonly describe = "Validates migrations: name format, duplicates, order, presence of up/down";
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem);
    run(_argv: string[]): Promise<void>;
    private resolveMigrationsDir;
    private readMigrationFiles;
    private parseFilenames;
    private detectDuplicates;
    private checkOrder;
    private ensureTsSupport;
    private validateExports;
    private report;
}
//# sourceMappingURL=MigrationsValidateCommand.d.ts.map