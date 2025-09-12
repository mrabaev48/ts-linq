import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { ChecksumPort, CliLogger, FsPort, LogLevel, ProcessPort } from './ports';

export class NodeFsPort implements FsPort {
  public exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
  public readText(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
  }
  public writeText(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }
  public mkdirp(dirPath: string): void {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  }
  public list(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath);
  }
}

export class NodeProcessPort implements ProcessPort {
  public cwd(): string {
    return process.cwd();
  }
  public env(name: string): string | undefined {
    return process.env[name];
  }
  public setExitCode(code: number): void {
    process.exitCode = code;
  }
}

export class NodeChecksumPort implements ChecksumPort {
  public sha256(filePath: string): string {
    const data = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }
}

export class ConsoleLogger implements CliLogger {
  public log(level: LogLevel, message: string): void {
    // Minimal mapping; could be extended for quiet/verbose handling
    switch (level) {
      case 'debug':
      case 'info':
        // eslint-disable-next-line no-console
        console.log(message);
        break;
      case 'warn':
        // eslint-disable-next-line no-console
        console.warn(message);
        break;
      case 'error':
        // eslint-disable-next-line no-console
        console.error(message);
        break;
      default:
        // eslint-disable-next-line no-console
        console.log(message);
        break;
    }
  }
}
