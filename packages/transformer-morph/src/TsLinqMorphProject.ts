import * as fs from 'node:fs';
import * as path from 'node:path';

import { ValidationError } from '@ts-linq/types';
import type { Expression as MorphExpression } from 'ts-morph';
import { Node, Project, SyntaxKind } from 'ts-morph';
import * as ts from 'typescript';

import { createWhereTransformer } from './core';
import { createTsLinqCustomTransformers } from './customTransformers';
import { DiagnosticCollector } from './DiagnosticCollector';

/** Brand carried by `Queryable`/`TypedQueryable` receivers (`where`/`having`/`select`). */
const QUERYABLE_BRAND = '__tsLinqWhereTransformerBrand';
/** Brand carried by `EntityTypeBuilder` receivers (`hasQueryFilter`). */
const ENTITY_TYPE_BUILDER_BRAND = '__tsLinqEntityTypeBuilderBrand';

/**
 * Method name → required receiver brand. Mirrors the transformer's
 * `CallRewriteVisitor.DISPATCH` map; used for reporting only — the actual rewrite
 * decision is always made by the transformer itself.
 */
const TARGET_METHOD_BRANDS: ReadonlyMap<string, string> = new Map([
  ['where', QUERYABLE_BRAND],
  ['having', QUERYABLE_BRAND],
  ['select', QUERYABLE_BRAND],
  ['hasQueryFilter', ENTITY_TYPE_BUILDER_BRAND]
]);

export interface TsLinqMorphProjectOptions {
  /** Path to the project's `tsconfig.json` (absolute or relative to `cwd`). */
  readonly tsConfigFilePath: string;
  /**
   * Compiler options applied on top of the ones parsed from the tsconfig
   * (highest precedence), e.g. an `outDir` override for side-by-side emit.
   */
  readonly compilerOptions?: ts.CompilerOptions;
}

/** A call site the transformer will consider for rewriting. */
export interface RewriteCandidate {
  readonly filePath: string;
  /** 1-based. */
  readonly line: number;
  /** 1-based. */
  readonly column: number;
  /** `where` | `having` | `select` | `hasQueryFilter`. */
  readonly methodName: string;
  readonly receiverText: string;
  /**
   * `true` when the receiver's type carries the required ts-linq brand, i.e.
   * the scope guard will let the rewrite proceed. Note this is a necessary but
   * not sufficient condition — a rewriter may still skip an individual call
   * (e.g. a non-literal `select` projection) and report a diagnostic instead.
   */
  readonly receiverIsBranded: boolean;
}

export interface TransformedSourceFile {
  readonly fileName: string;
  /** `true` when at least one call in the file was rewritten. */
  readonly changed: boolean;
  /**
   * Post-transform source text. Unchanged files keep their original text
   * byte-for-byte; changed files keep original text everywhere except the
   * top-level statements that actually contain a rewrite.
   */
  readonly text: string;
}

export interface SourceTransformResult {
  readonly files: readonly TransformedSourceFile[];
  /** Transform-time diagnostics reported through the DiagnosticSink. */
  readonly diagnostics: readonly ts.Diagnostic[];
}

export interface MorphEmitResult {
  readonly emitSkipped: boolean;
  /** Diagnostics reported by the ts-linq transformer during emit. */
  readonly transformDiagnostics: readonly ts.Diagnostic[];
  /** Diagnostics produced by the emit itself (write errors, ...). */
  readonly emitDiagnostics: readonly ts.Diagnostic[];
  readonly emittedFiles: readonly string[];
}

/**
 * ts-patch-free host for the ts-linq compile-time transformer.
 *
 * Two cooperating layers, each used strictly for what it is best at:
 *
 * - **ts-morph** (`getMorphProject`) — project model: tsconfig loading for
 *   analysis, type-aware navigation ({@link analyze}) and a convenient surface
 *   for downstream codemods. ts-morph ships its own bundled compiler, so no
 *   ts-morph object ever crosses into the transform pipeline.
 * - **TypeScript Compiler API** (`getProgram`) — the transform/emit pipeline:
 *   a plain `ts.Program` built from the same tsconfig drives
 *   {@link transformSources} and {@link emit} through this package's own
 *   rewrite core (`src/core`, ported from `@ts-linq/transformer`). Single
 *   compiler instance end-to-end: the nodes, the checker and the transformer
 *   all come from the workspace `typescript` package.
 */
export class TsLinqMorphProject {
  public readonly tsConfigFilePath: string;

  private readonly compilerOptionOverrides: ts.CompilerOptions;
  private morphProject: Project | undefined;
  private program: ts.Program | undefined;

  constructor(options: TsLinqMorphProjectOptions) {
    this.tsConfigFilePath = ts.sys.resolvePath(options.tsConfigFilePath);
    this.compilerOptionOverrides = options.compilerOptions ?? {};
    if (!ts.sys.fileExists(this.tsConfigFilePath)) {
      throw new ValidationError(
        `ts-linq(transformer-morph): tsconfig not found at '${this.tsConfigFilePath}'.`
      );
    }
  }

  /** Lazily created ts-morph project (analysis / codemod layer). */
  public getMorphProject(): Project {
    if (this.morphProject === undefined) {
      this.morphProject = new Project({ tsConfigFilePath: this.tsConfigFilePath });
    }
    return this.morphProject;
  }

  /** Lazily created Compiler API program (transform / emit layer). */
  public getProgram(): ts.Program {
    if (this.program === undefined) {
      const parsed = this.parseConfig();
      this.program = ts.createProgram({
        rootNames: parsed.fileNames,
        options: { ...parsed.options, ...this.compilerOptionOverrides },
        projectReferences: parsed.projectReferences
      });
    }
    return this.program;
  }

  /** Full pre-emit diagnostics (syntactic + semantic + options) of the project. */
  public getPreEmitDiagnostics(): readonly ts.Diagnostic[] {
    return ts.getPreEmitDiagnostics(this.getProgram());
  }

  /**
   * Reports every `where`/`having`/`select`/`hasQueryFilter` call site in the
   * project together with whether its receiver carries the ts-linq type brand.
   * Pure analysis on the ts-morph layer — nothing is rewritten.
   */
  public analyze(): readonly RewriteCandidate[] {
    const candidates: RewriteCandidate[] = [];
    for (const sourceFile of this.getMorphProject().getSourceFiles()) {
      if (sourceFile.isDeclarationFile()) continue;
      if (sourceFile.isInNodeModules()) continue;
      for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const callee = call.getExpression();
        if (!Node.isPropertyAccessExpression(callee)) continue;
        const brand = TARGET_METHOD_BRANDS.get(callee.getName());
        if (brand === undefined) continue;
        const receiver = callee.getExpression();
        const { line, column } = sourceFile.getLineAndColumnAtPos(call.getStart());
        candidates.push({
          filePath: sourceFile.getFilePath(),
          line,
          column,
          methodName: callee.getName(),
          receiverText: receiver.getText(),
          receiverIsBranded: receiverHasBrand(receiver, brand)
        });
      }
    }
    return candidates;
  }

  /**
   * Runs the ts-linq transformer over every root source file in-memory and
   * returns the post-transform text per file, plus the transform diagnostics.
   * Nothing is written to disk — see {@link writeTransformedSources}.
   */
  public transformSources(): SourceTransformResult {
    const program = this.getProgram();
    const sink = new DiagnosticCollector();
    const rootNames = new Set(program.getRootFileNames());
    const sourceFiles = program
      .getSourceFiles()
      .filter((sf) => !sf.isDeclarationFile && rootNames.has(sf.fileName));

    const transformer = createWhereTransformer(program, sink);
    const result = ts.transform(sourceFiles, [transformer], program.getCompilerOptions());
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

    const files: TransformedSourceFile[] = sourceFiles.map((original, index) => {
      const transformed = result.transformed[index];
      const changed =
        transformed !== undefined && ts.isSourceFile(transformed) && transformed !== original;
      return {
        fileName: original.fileName,
        changed,
        text: changed
          ? renderTransformedText(original, transformed, printer)
          : original.getFullText()
      };
    });
    result.dispose();

    return { files, diagnostics: sink.diagnostics };
  }

  /**
   * Source-to-source mode: runs {@link transformSources} and writes the results.
   *
   * - `{ outDir }` mirrors the full source tree (changed and unchanged files)
   *   under `outDir`, preserving relative layout — intended for bundler
   *   pipelines that consume TypeScript sources.
   * - `{ overwrite: true }` rewrites only the changed files in place —
   *   destructive; intended for one-shot codemod-style usage.
   */
  public writeTransformedSources(
    options: { readonly outDir: string } | { readonly overwrite: true }
  ): SourceTransformResult {
    const result = this.transformSources();
    if ('overwrite' in options) {
      for (const file of result.files) {
        if (file.changed) writeFileEnsuringDir(file.fileName, file.text);
      }
      return result;
    }

    const outDir = ts.sys.resolvePath(options.outDir);
    const commonDir = commonDirectory(result.files.map((f) => f.fileName));
    for (const file of result.files) {
      const relative = file.fileName.slice(commonDir.length).replace(/^\/+/, '');
      writeFileEnsuringDir(joinPaths(outDir, relative), file.text);
    }
    return result;
  }

  /**
   * Type-checks nothing extra by itself — compiles and emits the whole project
   * with the ts-linq transformer applied as a `before` custom transformer.
   * Drop-in replacement for a `tspc`/ts-patch build.
   */
  public emit(): MorphEmitResult {
    const program = this.getProgram();
    const sink = new DiagnosticCollector();
    const emitResult = program.emit(
      undefined,
      undefined,
      undefined,
      false,
      createTsLinqCustomTransformers(program, sink)
    );
    return {
      emitSkipped: emitResult.emitSkipped,
      transformDiagnostics: sink.diagnostics,
      emitDiagnostics: emitResult.diagnostics,
      emittedFiles: emitResult.emittedFiles ?? []
    };
  }

  private parseConfig(): ts.ParsedCommandLine {
    const host: ts.ParseConfigFileHost = {
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new ValidationError(
          `ts-linq(transformer-morph): cannot parse '${this.tsConfigFilePath}': ` +
            ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')
        );
      }
    };
    const parsed = ts.getParsedCommandLineOfConfigFile(this.tsConfigFilePath, {}, host);
    if (parsed === undefined) {
      throw new ValidationError(
        `ts-linq(transformer-morph): cannot parse '${this.tsConfigFilePath}'.`
      );
    }
    const configErrors = parsed.errors.filter((e) => e.category === ts.DiagnosticCategory.Error);
    if (configErrors.length > 0) {
      const messages = configErrors
        .map((e) => ts.flattenDiagnosticMessageText(e.messageText, ' '))
        .join('; ');
      throw new ValidationError(
        `ts-linq(transformer-morph): invalid tsconfig '${this.tsConfigFilePath}': ${messages}`
      );
    }
    return parsed;
  }
}

/**
 * Brand probe on the ts-morph layer; mirrors the transformer's `hasTypeBrand`
 * contract — a thrown checker call means "not provably branded", never a crash.
 */
function receiverHasBrand(receiver: MorphExpression, brand: string): boolean {
  try {
    return receiver.getType().getProperty(brand) !== undefined;
  } catch {
    return false;
  }
}

/**
 * Splices rewritten top-level statements into the original text so unchanged
 * statements keep their exact formatting. Falls back to a full re-print when
 * the statement lists cannot be correlated (the transformer never adds or
 * removes top-level statements, so the fallback is defensive only).
 */
function renderTransformedText(
  original: ts.SourceFile,
  transformed: ts.SourceFile,
  printer: ts.Printer
): string {
  const originalStatements = original.statements;
  const transformedStatements = transformed.statements;
  if (originalStatements.length !== transformedStatements.length) {
    return printer.printFile(transformed);
  }

  let text = original.getFullText();
  for (let i = originalStatements.length - 1; i >= 0; i--) {
    const before = originalStatements[i];
    const after = transformedStatements[i];
    if (before === undefined || after === undefined || before === after) continue;
    const printed = printer.printNode(ts.EmitHint.Unspecified, after, original);
    text = text.slice(0, before.getStart(original)) + printed + text.slice(before.getEnd());
  }
  return text;
}

/** Longest common directory prefix of a set of absolute file paths. */
function commonDirectory(fileNames: readonly string[]): string {
  if (fileNames.length === 0) return '';
  const split = fileNames.map((f) => f.split('/').slice(0, -1));
  const first = split[0] ?? [];
  let depth = first.length;
  for (const parts of split) {
    let i = 0;
    while (i < depth && i < parts.length && parts[i] === first[i]) i++;
    depth = i;
  }
  return first.slice(0, depth).join('/');
}

function joinPaths(base: string, relative: string): string {
  return base.replace(/\/+$/, '') + '/' + relative;
}

function writeFileEnsuringDir(fileName: string, text: string): void {
  fs.mkdirSync(path.dirname(fileName), { recursive: true });
  fs.writeFileSync(fileName, text, 'utf8');
}
