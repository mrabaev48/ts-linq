export interface FsPort {
  exists(filePath: string): boolean;
  readText(filePath: string): string;
  writeText(filePath: string, content: string): void;
  mkdirp(dirPath: string): void;
  list(dirPath: string): string[];
}

export interface ProcessPort {
  cwd(): string;
  env(name: string): string | undefined;
  setExitCode(code: number): void;
}

export interface ChecksumPort {
  sha256(filePath: string): string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface CliLogger {
  log(level: LogLevel, message: string): void;
}
