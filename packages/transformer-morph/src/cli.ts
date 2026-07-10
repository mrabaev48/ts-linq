import { OrmError } from '@ts-linq/types';
import * as ts from 'typescript';

import { formatDiagnostics } from './DiagnosticCollector';
import { TsLinqMorphProject } from './TsLinqMorphProject';

/**
 * `ts-linq-transform` — ts-patch-free CLI for the ts-linq compile-time transformer.
 *
 * Commands:
 * - `build` — type-check, transform and emit the project (drop-in `tspc` replacement).
 * - `check` — run the transformer in-memory and report diagnostics without emitting.
 */

const USAGE = `Usage: ts-linq-transform <command> [options]

Commands:
  build                 Type-check, transform and emit the project (tspc replacement)
  check                 Run the transformer in-memory and report diagnostics (no emit)

Options:
  -p, --project <path>  Path to tsconfig.json (default: ./tsconfig.json)
  --list                (check) List every where/having/select/hasQueryFilter call site
  --no-pretty           Plain diagnostic output (no colors / code frames)
  -h, --help            Show this help
`;

export interface CliOptions {
  readonly command: 'build' | 'check';
  readonly project: string;
  readonly list: boolean;
  readonly pretty: boolean;
}

export type CliParseResult =
  | { readonly kind: 'options'; readonly options: CliOptions }
  | { readonly kind: 'help' }
  | { readonly kind: 'error'; readonly message: string };

export function parseCliArgs(argv: readonly string[]): CliParseResult {
  let command: 'build' | 'check' | undefined;
  let project = './tsconfig.json';
  let list = false;
  let pretty = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-h':
      case '--help':
        return { kind: 'help' };
      case '-p':
      case '--project': {
        const value = argv[i + 1];
        if (value === undefined || value.startsWith('-')) {
          return { kind: 'error', message: `Missing value for ${arg}.` };
        }
        project = value;
        i++;
        break;
      }
      case '--list':
        list = true;
        break;
      case '--no-pretty':
        pretty = false;
        break;
      case 'build':
      case 'check':
        if (command !== undefined) {
          return { kind: 'error', message: `Duplicate command '${arg}'.` };
        }
        command = arg;
        break;
      default:
        return { kind: 'error', message: `Unknown argument '${String(arg)}'.` };
    }
  }

  if (command === undefined) {
    return { kind: 'error', message: 'Missing command: expected `build` or `check`.' };
  }
  return { kind: 'options', options: { command, project, list, pretty } };
}

function hasErrors(diagnostics: readonly ts.Diagnostic[]): boolean {
  return diagnostics.some((d) => d.category === ts.DiagnosticCategory.Error);
}

function printDiagnostics(diagnostics: readonly ts.Diagnostic[], pretty: boolean): void {
  if (diagnostics.length === 0) return;
  process.stderr.write(formatDiagnostics(diagnostics, pretty));
}

function runBuild(options: CliOptions): number {
  const project = new TsLinqMorphProject({ tsConfigFilePath: options.project });
  const preEmit = project.getPreEmitDiagnostics();
  const result = project.emit();
  const all = [...preEmit, ...result.transformDiagnostics, ...result.emitDiagnostics];
  printDiagnostics(all, options.pretty);

  if (result.emitSkipped || hasErrors(all)) return 1;
  process.stdout.write(
    `ts-linq-transform: emitted ${result.emittedFiles.length > 0 ? result.emittedFiles.length : 'all'} file(s) with the ts-linq transformer applied.\n`
  );
  return 0;
}

function runCheck(options: CliOptions): number {
  const project = new TsLinqMorphProject({ tsConfigFilePath: options.project });

  if (options.list) {
    for (const candidate of project.analyze()) {
      const marker = candidate.receiverIsBranded ? 'rewrite' : 'skip   ';
      process.stdout.write(
        `${marker}  ${candidate.filePath}:${candidate.line}:${candidate.column}  ` +
          `.${candidate.methodName}() on \`${candidate.receiverText}\`\n`
      );
    }
  }

  const result = project.transformSources();
  printDiagnostics(result.diagnostics, options.pretty);

  const rewritten = result.files.filter((f) => f.changed).length;
  process.stdout.write(
    `ts-linq-transform: ${rewritten} of ${result.files.length} source file(s) contain rewrites; ` +
      `${result.diagnostics.length} transform diagnostic(s).\n`
  );
  return hasErrors(result.diagnostics) ? 1 : 0;
}

/** CLI entrypoint used by `bin/ts-linq-transform.cjs`. Returns the process exit code. */
export function runCli(argv: readonly string[]): number {
  const parsed = parseCliArgs(argv);
  if (parsed.kind === 'help') {
    process.stdout.write(USAGE);
    return 0;
  }
  if (parsed.kind === 'error') {
    process.stderr.write(`ts-linq-transform: ${parsed.message}\n\n${USAGE}`);
    return 2;
  }

  try {
    return parsed.options.command === 'build' ? runBuild(parsed.options) : runCheck(parsed.options);
  } catch (error) {
    if (error instanceof OrmError) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    throw error;
  }
}
