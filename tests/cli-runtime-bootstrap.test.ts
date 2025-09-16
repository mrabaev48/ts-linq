import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadBootstrapFiles } from '../src/cli/runtime/bootstrap';

describe('cli runtime bootstrap', () => {
  test('loads simple bootstrap file without errors', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const file = path.join(tmp, 'boot.js');
    fs.writeFileSync(file, 'global.__tslinq_boot_called = true;');
    await loadBootstrapFiles(['boot.js'], tmp);
    // @ts-expect-error global marker set by bootstrap
    expect(global.__tslinq_boot_called).toBe(true);
    // cleanup marker
    delete (global as unknown as { __tslinq_boot_called?: boolean }).__tslinq_boot_called;
  });
});
