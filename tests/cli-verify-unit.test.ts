import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { VerifyCommand } from '../src/cli/commands/verify';

describe('VerifyCommand unit', () => {
  test('creates baseline when missing', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const mig = path.join(tmp, 'migrations');
    fs.mkdirSync(mig);
    fs.writeFileSync(path.join(mig, 'index.ts'), 'export default [];');
    const cmd = new VerifyCommand();
    const code = await cmd.execute([], { cwd: tmp, json: true });
    expect(code).toBe(0);
    expect(fs.existsSync(path.join(mig, '.tslinq.checksum'))).toBe(true);
  });
});


