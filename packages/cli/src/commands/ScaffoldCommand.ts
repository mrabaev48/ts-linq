import type { DatabaseProvider } from '@ts-linq/core';
import { scaffoldDbContext } from '@ts-linq/migrations';
import type {
  DbIntrospector,
  ScaffoldConnectionOptions,
  ScaffoldProviderKind
} from '@ts-linq/types';

import { ConsoleLogger } from '../adapters/ConsoleLogger';
import type { Logger } from '../ports/Logger';
import { ArgReader } from '../services/ArgReader';
import type { Command } from './Command';

export class ScaffoldCommand implements Command {
  public readonly name = 'scaffold';
  public readonly describe =
    'Reverse-engineers an existing database and generates entity classes and DbContext';
  public readonly aliases: string[] = [];

  public constructor(private readonly logger: Logger = new ConsoleLogger()) {}

  public async run(argv: string[]): Promise<void> {
    const args = new ArgReader(argv);

    const connection = args.flag('connection') as string | undefined;
    if (!connection) {
      this.logger.error('--connection is required');
      process.exitCode = 1;
      return;
    }

    const providerRaw = (args.flag('provider') as string | undefined) ?? 'postgres';
    const provider = this.resolveProvider(providerRaw);
    if (!provider) {
      this.logger.error(`Unsupported --provider: ${providerRaw}. Use postgres, mysql, or mssql.`);
      process.exitCode = 1;
      return;
    }

    const outputDir = (args.flag('output-dir') as string | undefined) ?? 'src/models';
    const contextName = (args.flag('context') as string | undefined) ?? 'AppContext';
    const useDatabaseNames = args.flag('use-database-names') === true;
    const noPluralize = args.flag('no-pluralize') === true;
    const schema = args.flag('schema') as string | undefined;
    const tablesRaw = args.flag('tables') as string | undefined;
    const tables = tablesRaw ? tablesRaw.split(',').map((t) => t.trim()) : undefined;

    const connOpts: ScaffoldConnectionOptions = {
      connection,
      provider,
      outputDir,
      contextName,
      useDatabaseNames,
      pluralize: !noPluralize,
      schema,
      tables
    };

    this.logger.info(`Scaffolding database (${provider}) → ${outputDir} [context: ${contextName}]`);

    const dbProvider = await this.createProvider(connOpts);
    await dbProvider.connect();

    try {
      const introspector = await this.createIntrospector(provider, dbProvider);
      await scaffoldDbContext(dbProvider, introspector, connOpts);
    } finally {
      await dbProvider.disconnect();
    }

    this.logger.info('Scaffold complete.');
  }

  private async createProvider(opts: ScaffoldConnectionOptions): Promise<DatabaseProvider> {
    const { connection, provider } = opts;

    if (provider === 'postgres') {
      const { PostgresProvider } = await import('@ts-linq/provider-postgres');
      const parsed = new URL(connection);
      const params = new URLSearchParams(parsed.search);
      return new PostgresProvider({
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port) : 5432,
        database: parsed.pathname.slice(1),
        user: parsed.username,
        password: parsed.password,
        schema: params.get('schema') ?? undefined
      }) as unknown as DatabaseProvider;
    }

    if (provider === 'mysql') {
      const { MySqlProvider } = await import('@ts-linq/provider-mysql');
      const parsed = new URL(connection);
      return new MySqlProvider({
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port) : 3306,
        database: parsed.pathname.slice(1),
        user: parsed.username,
        password: parsed.password
      }) as unknown as DatabaseProvider;
    }

    const { MssqlProvider } = await import('@ts-linq/provider-mssql');
    const parts = connection.split(';').reduce(
      (acc, part) => {
        const eqIdx = part.indexOf('=');
        if (eqIdx > 0) {
          const key = part.slice(0, eqIdx).trim().toLowerCase();
          const val = part.slice(eqIdx + 1).trim();
          acc[key] = val;
        }
        return acc;
      },
      {} as Record<string, string>
    );
    return new MssqlProvider({
      server: parts['server'] ?? 'localhost',
      database: parts['database'] ?? parts['initial catalog'] ?? '',
      user: parts['user id'] ?? parts['uid'],
      password: parts['password'] ?? parts['pwd'],
      encrypt: parts['encrypt'] === 'true' || parts['encrypt'] === 'True',
      trustServerCertificate:
        parts['trustservercertificate'] === 'true' || parts['trustservercertificate'] === 'True'
    }) as unknown as DatabaseProvider;
  }

  private async createIntrospector(
    kind: ScaffoldProviderKind,
    dbProvider: DatabaseProvider
  ): Promise<DbIntrospector> {
    if (kind === 'postgres') {
      const { PostgresDbIntrospector } = await import('@ts-linq/dialect-postgres');
      return new PostgresDbIntrospector(dbProvider);
    }
    if (kind === 'mysql') {
      const { MySqlDbIntrospector } = await import('@ts-linq/dialect-mysql');
      return new MySqlDbIntrospector(dbProvider);
    }
    const { MssqlDbIntrospector } = await import('@ts-linq/dialect-mssql');
    return new MssqlDbIntrospector(dbProvider);
  }

  private resolveProvider(raw: string): ScaffoldProviderKind | undefined {
    const lower = raw.toLowerCase();
    if (lower === 'postgres' || lower === 'postgresql' || lower === 'pg') return 'postgres';
    if (lower === 'mysql') return 'mysql';
    if (lower === 'mssql' || lower === 'sqlserver') return 'mssql';
    return undefined;
  }
}
