import type { Logger } from '../ports/Logger';

export class ConsoleLogger implements Logger {
  public info(message: string): void {
    // eslint-disable-next-line no-console
    console.log(message);
  }
  public warn(message: string): void {
    // eslint-disable-next-line no-console
    console.warn(message);
  }
  public error(message: string): void {
    // eslint-disable-next-line no-console
    console.error(message);
  }
}
