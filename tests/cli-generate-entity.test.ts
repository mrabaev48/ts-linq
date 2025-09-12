import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function runCli(args: string[]) {
  const node = process.execPath;
  const cliPath = path.resolve(__dirname, '..', 'src', 'bin', 'ts-linq-cli.ts');
  const result = cp.spawnSync(
    node,
    ['-r', 'ts-node/register/transpile-only', cliPath, ...args],
    {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env },
      encoding: 'utf8'
    }
  );
  return { code: result.status ?? 0, stdout: result.stdout, stderr: result.stderr };
}

describe('CLI generate entity', () => {
  test('creates entity file with decorators', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const r = runCli(['generate', 'entity', 'User', `--cwd=${tmp}`]);
    expect(r.code).toBe(0);
    const file = path.join(tmp, 'src', 'entities', 'User.ts');
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toContain("@Entity()");
    expect(content).toContain("@PrimaryKey()");
    expect(content).toContain("@Column(");
  });

  test('supports --dir, --pk, --columns', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tslinq-cli-'));
    const outDir = 'models';
    const r = runCli([
      'generate',
      'entity',
      'Product',
      `--cwd=${tmp}`,
      `--dir=${outDir}`,
      `--pk=productId`,
      `--columns=title:string,price:number,active:boolean?`
    ]);
    expect(r.code).toBe(0);
    const file = path.join(tmp, outDir, 'Product.ts');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toContain('public productId!: number;');
    expect(content).toContain("public title!: string");
    expect(content).toContain("public price!: number");
    expect(content).toContain("public active!: boolean");
  });
});


