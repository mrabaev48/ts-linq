import type { FileSystem } from '../ports/FileSystem';
export declare class NodeFs implements FileSystem {
  exists(p: string): boolean;
  readText(p: string): string;
  writeText(p: string, contents: string): void;
  ensureDir(dirPath: string): void;
  readDir(p: string): string[];
}
//# sourceMappingURL=NodeFs.d.ts.map
