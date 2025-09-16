import * as os from 'os';
import * as path from 'path';
import {
  ConsoleLogger,
  NodeChecksumPort,
  NodeFsPort,
  NodeProcessPort
} from '../src/cli/runtime/nodeAdapters';

describe('Node adapters', () => {
  test('FsPort read/write/mkdirp', () => {
    const tmp = path.join(os.tmpdir(), `tslinq-fsport-${Date.now()}`);
    const fsp = new NodeFsPort();
    expect(fsp.exists(tmp)).toBe(false);
    fsp.mkdirp(tmp);
    expect(fsp.exists(tmp)).toBe(true);
    const file = path.join(tmp, 'a.txt');
    fsp.writeText(file, 'x');
    expect(fsp.readText(file)).toBe('x');
    expect(fsp.list(tmp)).toContain('a.txt');
  });

  test('ProcessPort env access', () => {
    const proc = new NodeProcessPort();
    expect(proc.cwd()).toBe(process.cwd());
    process.env.TEST_KEY = '1';
    expect(proc.env('TEST_KEY')).toBe('1');
  });

  test('ChecksumPort sha256 returns hex', () => {
    const fsp = new NodeFsPort();
    const tmpFile = path.join(os.tmpdir(), `tslinq-hash-${Date.now()}.txt`);
    fsp.writeText(tmpFile, 'abc');
    const sum = new NodeChecksumPort().sha256(tmpFile);
    expect(sum).toMatch(/^[a-f0-9]{64}$/);
  });

  test('ConsoleLogger logs without throwing', () => {
    const logger = new ConsoleLogger();
    logger.log('info', 'ok');
    logger.log('warn', 'warn');
    logger.log('error', 'err');
  });
});
