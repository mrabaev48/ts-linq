import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { parseCliArgs, runCli } from '../src/cli';
import { createFixtureProject } from './helpers';

describe('parseCliArgs', () => {
  it('parses a build command with defaults', () => {
    const parsed = parseCliArgs(['build']);
    expect(parsed).toEqual({
      kind: 'options',
      options: { command: 'build', project: './tsconfig.json', list: false, pretty: true }
    });
  });

  it('parses check with --project, --list and --no-pretty', () => {
    const parsed = parseCliArgs(['check', '-p', 'foo/tsconfig.json', '--list', '--no-pretty']);
    expect(parsed).toEqual({
      kind: 'options',
      options: { command: 'check', project: 'foo/tsconfig.json', list: true, pretty: false }
    });
  });

  it('returns help for --help', () => {
    expect(parseCliArgs(['--help'])).toEqual({ kind: 'help' });
  });

  it('rejects a missing command', () => {
    expect(parseCliArgs([])).toMatchObject({ kind: 'error' });
  });

  it('rejects an unknown argument', () => {
    expect(parseCliArgs(['build', '--frobnicate'])).toMatchObject({ kind: 'error' });
  });

  it('rejects --project without a value', () => {
    expect(parseCliArgs(['build', '--project'])).toMatchObject({ kind: 'error' });
  });
});

describe('runCli', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function muteStdio(): { stdout: string[]; stderr: string[] } {
    const stdout: string[] = [];
    const stderr: string[] = [];
    jest.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdout.push(String(chunk));
      return true;
    });
    jest.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    });
    return { stdout, stderr };
  }

  it('check succeeds on a clean fixture and reports the rewrite count', () => {
    const fixture = createFixtureProject(
      [
        "import { Queryable } from '@ts-linq/query';",
        'type User = { id: number };',
        'const q = new Queryable<User>();',
        'q.where(u => u.id > 1);'
      ].join('\n')
    );
    const { stdout } = muteStdio();

    const exitCode = runCli(['check', '-p', fixture.tsConfigFilePath, '--no-pretty']);

    expect(exitCode).toBe(0);
    expect(stdout.join('')).toContain('1 of 2 source file(s) contain rewrites');
  });

  it('check fails with exit code 1 on unsupported expressions', () => {
    const fixture = createFixtureProject(
      [
        "import { Queryable } from '@ts-linq/query';",
        'type User = { id: number };',
        'const q = new Queryable<User>();',
        'q.where(u => (u.id + 1) > 0);'
      ].join('\n')
    );
    const { stderr } = muteStdio();

    const exitCode = runCli(['check', '-p', fixture.tsConfigFilePath, '--no-pretty']);

    expect(exitCode).toBe(1);
    expect(stderr.join('')).toContain('is not supported');
  });

  it('build emits and returns 0 on a clean fixture', () => {
    const fixture = createFixtureProject(
      [
        "import { Queryable } from '@ts-linq/query';",
        'type User = { id: number };',
        'const q = new Queryable<User>();',
        'q.where(u => u.id > 1);'
      ].join('\n')
    );
    muteStdio();

    const exitCode = runCli(['build', '-p', fixture.tsConfigFilePath, '--no-pretty']);

    expect(exitCode).toBe(0);
    expect(fixture.readOutput('dist/consumer.js')).toContain('whereCompiled');
  });

  it('returns 1 with a readable message when the tsconfig is missing', () => {
    const { stderr } = muteStdio();

    const exitCode = runCli(['build', '-p', '/nonexistent/tsconfig.json', '--no-pretty']);

    expect(exitCode).toBe(1);
    expect(stderr.join('')).toContain('tsconfig not found');
  });

  it('returns 2 and prints usage on unknown arguments', () => {
    const { stderr } = muteStdio();

    const exitCode = runCli(['--wat']);

    expect(exitCode).toBe(2);
    expect(stderr.join('')).toContain('Usage: ts-linq-transform');
  });
});
