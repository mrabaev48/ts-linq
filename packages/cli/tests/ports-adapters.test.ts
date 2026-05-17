import * as fs from 'fs';
import * as path from 'path';

import { ConsoleLogger } from '../src/adapters/ConsoleLogger';
import { NodeFs } from '../src/adapters/NodeFs';
import type { FileSystem } from '../src/ports/FileSystem';

describe('ConsoleLogger', () => {
  it('delegates to console methods', () => {
    const logger = new ConsoleLogger();
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const spyErr = jest.spyOn(console, 'error').mockImplementation(() => {});

    logger.info('x');
    logger.warn('y');
    logger.error('z');

    expect(spyLog).toHaveBeenCalledWith('x');
    expect(spyWarn).toHaveBeenCalledWith('y');
    expect(spyErr).toHaveBeenCalledWith('z');

    spyLog.mockRestore();
    spyWarn.mockRestore();
    spyErr.mockRestore();
  });
});

describe('NodeFs', () => {
  let tmpDir: string;
  let fsAdapter: FileSystem;

  beforeEach(() => {
    tmpDir = path.join(process.cwd(), 'packages', 'cli', 'tests', 'tmp');
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fsAdapter = new NodeFs();
  });

  it('ensureDir + write/read/exists/readDir', () => {
    const f = path.join(tmpDir, 'a', 'b', 'file.txt');
    expect(fsAdapter.exists(f)).toBe(false);
    fsAdapter.writeText(f, 'hello');
    expect(fsAdapter.exists(f)).toBe(true);
    expect(fsAdapter.readText(f)).toBe('hello');

    const dir = path.dirname(f);
    const files = fsAdapter.readDir(dir);
    expect(files.includes('file.txt')).toBe(true);
  });
});
