import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import { ConsoleLogger } from '../adapters/ConsoleLogger';
import { startPrometheusServer } from '@ts-linq/core';

export class MetricsServeCommand implements Command {
  public readonly name = 'metrics:serve';
  public readonly describe = 'Запускает HTTP-сервер для экспорта метрик Prometheus';
  public readonly aliases = ['metrics', 'prometheus'];

  public constructor(private readonly logger: Logger = new ConsoleLogger()) {}

  public async run(argv: string[]): Promise<void> {
    const { port, path } = this.parseArgs(argv);
    try {
      const { server, port: actualPort, close } = await startPrometheusServer({ port, path });
      this.logger.info(`Prometheus metrics server запущен: http://127.0.0.1:${actualPort}${path}`);
      const shutdown = async (signal: string) => {
        this.logger.info(`Получен сигнал ${signal}. Остановка метрик...`);
        try {
          await close();
          this.logger.info('Сервер метрик остановлен.');
        } catch (e) {
          this.logger.warn?.(`Ошибка при остановке сервера метрик: ${(e as Error).message}`);
        } finally {
          process.exit(0);
        }
      };
      process.on('SIGINT', () => void shutdown('SIGINT'));
      process.on('SIGTERM', () => void shutdown('SIGTERM'));
      // Держим процесс живым
      server.on('close', () => {
        this.logger.info('HTTP-сервер метрик закрыт');
      });
    } catch (e) {
      this.logger.error(
        `Не удалось запустить сервер метрик: ${(e as Error)?.message || String(e)}`
      );
      process.exitCode = 1;
    }
  }

  private parseArgs(argv: string[]): { port?: number; path: string } {
    let port: number | undefined;
    let metricsPath = '/metrics';

    for (let i = 1; i < argv.length; i++) {
      const arg = argv[i];
      if (!arg) continue;
      if (arg.startsWith('--port=')) {
        const v = Number(arg.slice('--port='.length));
        if (!Number.isNaN(v) && v >= 0) port = v;
        continue;
      }
      if (arg === '--port') {
        const v = Number(argv[i + 1]);
        if (!Number.isNaN(v) && v >= 0) port = v;
        i++;
        continue;
      }
      if (arg.startsWith('--path=')) {
        const p = arg.slice('--path='.length);
        if (p) metricsPath = p.startsWith('/') ? p : `/${p}`;
        continue;
      }
      if (arg === '--path') {
        const p = argv[i + 1];
        if (p) metricsPath = p.startsWith('/') ? p : `/${p}`;
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
