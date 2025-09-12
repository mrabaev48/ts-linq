import { parseArgs } from '../src/cli/runtime/args';

describe('cli runtime parseArgs', () => {
  test('parses command, rest and flags', () => {
    const { cmd, rest, flags } = parseArgs([
      'diff',
      '--provider=sqlite',
      '--conn=:memory:',
      '--json',
      '--dry-run',
      '--cwd=/tmp/x',
      '--to=001',
      '--step=2',
      '--verbose',
      '--out=plan.sql'
    ]);
    expect(cmd).toBe('diff');
    expect(rest).toEqual([]);
    expect(flags.provider).toBe('sqlite');
    expect(flags.conn).toBe(':memory:');
    expect(flags.json).toBe(true);
    expect(flags.dryRun).toBe(true);
    expect(flags.cwd).toBe('/tmp/x');
    expect(flags.toVersion).toBe('001');
    expect(flags.step).toBe(2);
    expect(flags.verbose).toBe(true);
    expect(flags.out).toBe('plan.sql');
  });

  test('short flags set help/version', () => {
    const { cmd } = parseArgs(['-hv']);
    // help should win first for -hv, version is secondary
    expect(cmd).toBe('help');
  });
});


