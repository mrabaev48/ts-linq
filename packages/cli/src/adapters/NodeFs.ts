import * as fs from 'fs';
import * as path from 'path';
import type { FileSystem } from '../ports/FileSystem';

export class NodeFs implements FileSystem {
  public exists(p: string): boolean {
    return fs.existsSync(p);
  }
  public readText(p: string): string {
    return fs.readFileSync(p, 'utf8');
  }
  public writeText(p: string, contents: string): void {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, contents, 'utf8');
  }
  public ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  }
  public readDir(p: string): string[] {
    return fs.readdirSync(p);
  }
}
