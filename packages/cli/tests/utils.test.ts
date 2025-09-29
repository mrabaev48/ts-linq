import * as fs from 'fs';
import * as path from 'path';
import { getFlag, resolveDialect, ensureDir, writeFileIfMissing, validateEnv } from '../src/utils';

describe('utils', () => {
  it('getFlag supports --flag, --flag=value, and returns true for bare flag', () => {
    expect(getFlag(['cmd', '--name', 'user'], 'name')).toBe('user');
    expect(getFlag(['cmd', '--name=user'], 'name')).toBe('user');
    expect(getFlag(['cmd', '--dry-run'], 'dry-run')).toBe(true);
    expect(getFlag(['cmd'], 'x')).toBeUndefined();
  });

  it('resolveDialect maps allowed or defaults to sqlite', () => {
    expect(resolveDialect('postgresql')).toBe('postgresql');
    expect(resolveDialect('mysql')).toBe('mysql');
    expect(resolveDialect('mssql')).toBe('mssql');
    expect(resolveDialect('unknown')).toBe('sqlite');
  });

  it('ensureDir and writeFileIfMissing', () => {
    const dir = path.join(process.cwd(), 'packages', 'cli', 'tests', 'tmp-utils');
    const file = path.join(dir, 'sub', 'file.txt');
    fs.rmSync(dir, { recursive: true, force: true });
    ensureDir(path.join(dir, 'sub'));
    expect(fs.existsSync(path.join(dir, 'sub'))).toBe(true);
    writeFileIfMissing(file, 'hello');
    expect(fs.readFileSync(file, 'utf8')).toBe('hello');
    writeFileIfMissing(file, 'changed');
    expect(fs.readFileSync(file, 'utf8')).toBe('hello');
  });

  it('validateEnv prints missing', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const ok = validateEnv(['SHOULD_NOT_EXIST_12345']);
    expect(ok).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
