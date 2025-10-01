import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
export declare class SchemaExportCommand implements Command {
    private readonly logger;
    private readonly fsAdapter;
    readonly name = "schema:export";
    readonly describe = "\u042D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u0443\u0435\u0442 snapshot \u0441\u0445\u0435\u043C\u044B \u0438\u0437 \u043C\u0435\u0442\u0430\u0434\u0430\u043D\u043D\u044B\u0445 \u0432 \u0444\u0430\u0439\u043B";
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem);
    run(argv: string[]): Promise<void>;
}
//# sourceMappingURL=SchemaExportCommand.d.ts.map