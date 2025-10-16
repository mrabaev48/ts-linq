import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
export declare class MetricsServeCommand implements Command {
    private readonly logger;
    readonly name = "metrics:serve";
    readonly describe = "\u0417\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442 HTTP-\u0441\u0435\u0440\u0432\u0435\u0440 \u0434\u043B\u044F \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0430 \u043C\u0435\u0442\u0440\u0438\u043A Prometheus";
    readonly aliases: string[];
    constructor(logger?: Logger);
    run(argv: string[]): Promise<void>;
    private parseArgs;
}
//# sourceMappingURL=MetricsServeCommand.d.ts.map