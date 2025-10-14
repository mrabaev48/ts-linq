import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class SchemaExportCommand implements Command {
    private readonly logger;
    private readonly fsAdapter;
    readonly name = "schema:export";
    readonly describe = "Exports schema snapshot from metadata to a file";
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem);
    run(argv: string[]): Promise<void>;
}
//# sourceMappingURL=SchemaExportCommand.d.ts.map