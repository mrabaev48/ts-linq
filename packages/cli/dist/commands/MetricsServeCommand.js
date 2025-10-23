"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsServeCommand = void 0;
const ConsoleLogger_1 = require("../adapters/ConsoleLogger");
const core_1 = require("@ts-linq/core");
class MetricsServeCommand {
    constructor(logger = new ConsoleLogger_1.ConsoleLogger()) {
        this.logger = logger;
        this.name = 'metrics:serve';
        this.describe = 'Запускает HTTP-сервер для экспорта метрик Prometheus';
        this.aliases = ['metrics', 'prometheus'];
    }
    async run(argv) {
        const { port, path } = this.parseArgs(argv);
        try {
            const { server, port: actualPort, close } = await (0, core_1.startPrometheusServer)({ port, path });
            this.logger.info(`Prometheus metrics server запущен: http://127.0.0.1:${actualPort}${path}`);
            const shutdown = async (signal) => {
                this.logger.info(`Получен сигнал ${signal}. Остановка метрик...`);
                try {
                    await close();
                    this.logger.info('Сервер метрик остановлен.');
                }
                catch (e) {
                    this.logger.warn?.(`Ошибка при остановке сервера метрик: ${e.message}`);
                }
                finally {
                    process.exit(0);
                }
            };
            process.on('SIGINT', () => void shutdown('SIGINT'));
            process.on('SIGTERM', () => void shutdown('SIGTERM'));
            // Держим процесс живым
            server.on('close', () => {
                this.logger.info('HTTP-сервер метрик закрыт');
            });
        }
        catch (e) {
            this.logger.error(`Не удалось запустить сервер метрик: ${e?.message || String(e)}`);
            process.exitCode = 1;
        }
    }
    parseArgs(argv) {
        let port;
        let metricsPath = '/metrics';
        for (let i = 1; i < argv.length; i++) {
            const arg = argv[i];
            if (!arg)
                continue;
            if (arg.startsWith('--port=')) {
                const v = Number(arg.slice('--port='.length));
                if (!Number.isNaN(v) && v >= 0)
                    port = v;
                continue;
            }
            if (arg === '--port') {
                const v = Number(argv[i + 1]);
                if (!Number.isNaN(v) && v >= 0)
                    port = v;
                i++;
                continue;
            }
            if (arg.startsWith('--path=')) {
                const p = arg.slice('--path='.length);
                if (p)
                    metricsPath = p.startsWith('/') ? p : `/${p}`;
                continue;
            }
            if (arg === '--path') {
                const p = argv[i + 1];
                if (p)
                    metricsPath = p.startsWith('/') ? p : `/${p}`;
                i++;
                continue;
            }
            // позиционный первый аргумент как порт
            if (port === undefined) {
                const v = Number(arg);
                if (!Number.isNaN(v) && v >= 0) {
                    port = v;
                    continue;
                }
            }
        }
        return { port, path: metricsPath };
    }
}
exports.MetricsServeCommand = MetricsServeCommand;
//# sourceMappingURL=MetricsServeCommand.js.map