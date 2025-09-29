export interface FileSystem {
  exists(path: string): boolean;
  readText(path: string): string;
  writeText(path: string, contents: string): void;
  ensureDir(path: string): void;
  readDir(path: string): string[];
}
