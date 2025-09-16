export type ProviderId = 'sqlite' | 'postgresql' | 'mysql' | 'mssql';

export interface Flags {
  provider?: ProviderId;
  conn?: string;
  json?: boolean;
  details?: boolean;
  dryRun?: boolean;
  cwd?: string;
  toVersion?: string;
  step?: number;
  verbose?: boolean;
  quiet?: boolean;
  out?: string;
  create?: boolean;
  yes?: boolean;
  db?: boolean;
  file?: string;
  transaction?: boolean;
  // generator options
  dir?: string;
  pk?: string;
  columns?: string;
  // diff scaffold options
  name?: string;
}

export interface CliConfig {
  provider?: ProviderId;
  connectionString?: string | { env: string };
  migrationsDir?: string;
  seedsDir?: string;
  entitiesGlobs?: string[];
  metrics?: { enabled?: boolean };
  bootstrap?: string[];
}

export interface EffectiveConfig {
  provider: ProviderId;
  connectionString: string;
  migrationsDir: string;
  seedsDir: string;
  entitiesGlobs: string[];
  metrics: { enabled: boolean };
  bootstrap: string[];
}
