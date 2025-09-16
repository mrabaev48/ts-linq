import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { makeEffectiveConfig } from '../src/cli/runtime/config';

describe('cli runtime makeEffectiveConfig', () => {
  test('resolves provider/conn from json config', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    fs.writeFileSync(
      path.join(tmp, 'tslinq.config.json'),
      JSON.stringify({
        provider: 'sqlite',
        connectionString: ':memory:',
        migrationsDir: 'm',
        seedsDir: 's'
      }),
      'utf8'
    );
    const effective = makeEffectiveConfig({ cwd: tmp });
    expect(effective.provider).toBe('sqlite');
    expect(effective.connectionString).toBe(':memory:');
    expect(effective.migrationsDir).toBe(path.resolve(tmp, 'm'));
    expect(effective.seedsDir).toBe(path.resolve(tmp, 's'));
  });
});
