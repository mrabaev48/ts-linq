import { createMetadataRegistry } from '@ts-linq/metadata';
import * as path from 'path';

import { ConsoleLogger } from '../adapters/ConsoleLogger';
import { NodeFs } from '../adapters/NodeFs';
import { StubDatabaseProvider } from '../bootstrap/StubDatabaseProvider';
import { CompiledModelEmitter } from '../generators/CompiledModelEmitter';
import type { FileSystem } from '../ports/FileSystem';
import type { Logger } from '../ports/Logger';
import { ArgReader } from '../services/ArgReader';
import type { Command } from './Command';

/**
 * `dbcontext optimize` — generates a pre-compiled model snapshot for a DbContext.
 *
 * Mirrors EF Core's `dotnet ef dbcontext optimize`.
 *
 * Usage:
 *   pnpm ts-linq dbcontext optimize --context ./src/AppContext.ts --output src/compiled-models
 *
 * Flags:
 *   --context  Path to the JS/TS module that exports the DbContext subclass (required).
 *   --output   Output directory for the generated file (default: src/compiled-models).
 *   --check    Drift-check mode: exit 1 if the generated content differs from disk, 0 otherwise.
 *              Does not write files in check mode.
 */
export class DbContextOptimizeCommand implements Command {
  public readonly name = 'dbcontext optimize';
  public readonly describe =
    'Generates a pre-compiled AOT model snapshot for a DbContext (mirrors EF Core dbcontext optimize)';
  public readonly aliases: string[] = [];

  public constructor(
    private readonly logger: Logger = new ConsoleLogger(),
    private readonly fsAdapter: FileSystem = new NodeFs(),
    private readonly emitter: CompiledModelEmitter = new CompiledModelEmitter(new NodeFs())
  ) {}

  public async run(argv: string[]): Promise<void> {
    const args = new ArgReader(argv);

    const contextPath = args.flag('context') as string | undefined;
    if (!contextPath) {
      this.logger.error('--context <path> is required');
      process.exitCode = 1;
      return;
    }

    const outputDir = (args.flag('output') as string | undefined) ?? 'src/compiled-models';
    const checkMode = args.flag('check') === true;

    const resolvedContext = path.resolve(process.cwd(), contextPath);

    let contextModule: Record<string, unknown>;
    try {
      contextModule = require(resolvedContext) as Record<string, unknown>;
    } catch (err) {
      this.logger.error(
        `Failed to load context module "${resolvedContext}": ${err instanceof Error ? err.message : String(err)}`
      );
      process.exitCode = 1;
      return;
    }

    const DbContextClass = this.findDbContextClass(contextModule);
    if (!DbContextClass) {
      this.logger.error(
        `No DbContext subclass found in module "${resolvedContext}". ` +
          `Make sure the file exports a class that extends DbContext.`
      );
      process.exitCode = 1;
      return;
    }

    const contextName = DbContextClass.name;
    this.logger.info(`Extracting model from ${contextName}...`);

    const registry = createMetadataRegistry();
    const stubProvider = new StubDatabaseProvider();

    try {
      new (DbContextClass as new (opts: object) => object)({
        provider: stubProvider,
        registry
      });
    } catch (err) {
      // Ignore errors thrown by onModelCreating that depend on a real provider.
      // We only need registry.getEntities() to be populated.
      if (process.env['TS_LINQ_OPTIMIZE_DEBUG']) {
        this.logger.warn(
          `DbContext constructor threw (expected for stub provider): ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    const entities = registry.getEntities();
    if (entities.length === 0) {
      this.logger.warn(
        `No entities found in ${contextName}. ` +
          `Make sure entity classes are decorated with @entity and registered in the DbContext.`
      );
    }

    this.logger.info(`Found ${entities.length} entity/entities.`);

    const { filePath, content } = this.emitter.emit(contextName, entities, outputDir);

    if (checkMode) {
      if (!this.fsAdapter.exists(filePath)) {
        this.logger.error(`[check] File not found: ${filePath}. Run without --check to generate.`);
        process.exitCode = 1;
        return;
      }

      const existing = this.fsAdapter.readText(filePath);
      // Compare excluding generatedAt timestamp line (changes every run)
      const normalize = (s: string) =>
        s
          .split('\n')
          .filter((l) => !l.includes('"generatedAt"'))
          .join('\n');

      if (normalize(existing) !== normalize(content)) {
        this.logger.error(
          `[check] Compiled model is out of date: ${filePath}. ` +
            `Re-run: pnpm ts-linq dbcontext optimize --context ${contextPath} --output ${outputDir}`
        );
        process.exitCode = 1;
        return;
      }

      this.logger.info(`[check] Compiled model is up to date: ${filePath}`);
      return;
    }

    this.logger.info(`Generated: ${filePath}`);
  }

  private findDbContextClass(
    module: Record<string, unknown>
  ): (new (...args: unknown[]) => object) | undefined {
    // Try to find a DbContext subclass by checking the prototype chain.
    // We look for classes whose prototype chain includes a class named 'DbContext'.
    for (const key of Object.keys(module)) {
      const value = module[key];
      if (typeof value !== 'function') continue;
      if (this.isDbContextSubclass(value as Function)) {
        return value as new (...args: unknown[]) => object;
      }
    }
    return undefined;
  }

  private isDbContextSubclass(ctor: Function): boolean {
    let proto = Object.getPrototypeOf(ctor);
    while (proto && proto !== Function.prototype) {
      if (proto.name === 'DbContext') return true;
      proto = Object.getPrototypeOf(proto);
    }
    return false;
  }
}
