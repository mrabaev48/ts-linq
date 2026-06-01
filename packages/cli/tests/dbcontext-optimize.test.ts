import 'reflect-metadata';

import { describe, expect, it } from '@jest/globals';

import { DbContextOptimizeCommand } from '../src/commands/DbContextOptimizeCommand';
import { CompiledModelEmitter } from '../src/generators/CompiledModelEmitter';
import type { FileSystem } from '../src/ports/FileSystem';
import type { Logger } from '../src/ports/Logger';

class MemFs implements FileSystem {
  public readonly files = new Map<string, string>();
  public exists(p: string): boolean {
    return this.files.has(p);
  }
  public readText(p: string): string {
    const v = this.files.get(p);
    if (v == null) throw new Error(`File not found: ${p}`);
    return v;
  }
  public writeText(p: string, contents: string): void {
    this.files.set(p, contents);
  }
  public ensureDir(_d: string): void {}
  public readDir(_d: string): string[] {
    return [];
  }
}

class SpyLogger implements Logger {
  public readonly messages: { level: string; msg: string }[] = [];
  public info(msg: string) {
    this.messages.push({ level: 'info', msg });
  }
  public warn(msg: string) {
    this.messages.push({ level: 'warn', msg });
  }
  public error(msg: string) {
    this.messages.push({ level: 'error', msg });
  }
}

describe('DbContextOptimizeCommand', () => {
  it('sets exitCode 1 when --context flag is missing', async () => {
    const logger = new SpyLogger();
    const cmd = new DbContextOptimizeCommand(logger, new MemFs());

    const prev = process.exitCode;
    await cmd.run(['dbcontext', 'optimize']);
    expect(process.exitCode).toBe(1);
    process.exitCode = prev;

    expect(logger.messages.some((m) => m.level === 'error' && m.msg.includes('--context'))).toBe(
      true
    );
  });

  it('sets exitCode 1 when context module does not exist', async () => {
    const logger = new SpyLogger();
    const cmd = new DbContextOptimizeCommand(logger, new MemFs());

    const prev = process.exitCode;
    await cmd.run(['dbcontext', 'optimize', '--context', '/nonexistent/path/ctx.js']);
    expect(process.exitCode).toBe(1);
    process.exitCode = prev;
  });
});

describe('CompiledModelEmitter', () => {
  it('writes a .generated.ts file to the output directory', () => {
    const fs = new MemFs();
    const emitter = new CompiledModelEmitter(fs);

    const entities = [
      {
        target: class User {},
        className: 'User',
        tableName: 'users',
        primaryKeys: ['id'],
        columns: [{ propertyName: 'id', columnName: 'id', type: 'int' as const, nullable: false }],
        relationships: [],
        indexes: []
      }
    ];

    const { filePath, content } = emitter.emit('AppContext', entities, 'src/compiled-models');

    expect(filePath).toContain('app-context-model.generated.ts');
    expect(fs.files.has(filePath)).toBe(true);
    expect(content).toContain('"contextClassName": "AppContext"');
    expect(content).toContain('"version": 1');
    expect(content).toContain('AppContextModel');
    expect(content).toContain('AppContextModelClassMap');
  });

  it('normalizes context class name to kebab-case for filename', () => {
    const fs = new MemFs();
    const emitter = new CompiledModelEmitter(fs);

    const { filePath } = emitter.emit('MyBlogContext', [], 'out');
    expect(filePath).toContain('my-blog-context-model.generated.ts');
  });

  it('includes entity columns in the generated snapshot', () => {
    const fs = new MemFs();
    const emitter = new CompiledModelEmitter(fs);

    const { content } = emitter.emit(
      'ShopContext',
      [
        {
          target: class Product {},
          className: 'Product',
          tableName: 'products',
          primaryKeys: ['id'],
          columns: [
            { propertyName: 'id', columnName: 'id', type: 'int' as const, nullable: false },
            {
              propertyName: 'title',
              columnName: 'title',
              type: 'varchar' as const,
              nullable: false
            }
          ],
          relationships: [],
          indexes: []
        }
      ],
      'out'
    );

    expect(content).toContain('"tableName": "products"');
    expect(content).toContain('"columnName": "id"');
    expect(content).toContain('"columnName": "title"');
  });
});
