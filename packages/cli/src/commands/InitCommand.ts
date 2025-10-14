import * as path from 'path';
import { ensureDir, writeFileIfMissing } from '../utils';
import type { Command } from './Command';

export class InitCommand implements Command {
  public readonly name = 'init';
  public readonly describe = 'Initialize a project with ts-linq skeleton';
  public run(argv: string[]): Promise<void> {
    const destArg = argv[1];
    const dest = path.resolve(process.cwd(), destArg || '.');
    if (destArg) ensureDir(dest);
    const withMigration = argv.includes('--with-migration');

    const tsconfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "useDefineForClassFields": true,
    "emitDecoratorMetadata": true,
    "sourceMap": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": { "@src/*": ["src/*"] }
  },
  "include": ["src/**/*", "migrations/**/*"],
  "exclude": ["node_modules", "dist"]
}
`;

    const configTs = `export default {
  provider: process.env.DB_PROVIDER || 'sqlite',
  connection: process.env.DATABASE_URL || process.env.SQLITE_URL || 'file:app.db',
  migrations: './migrations',
  entities: './src/entities'
};
`;

    const userEntity = `import { Entity, Column, PrimaryKey } from '@ts-linq/core';

@Entity('users')
export class User {
  @PrimaryKey()
  public id!: number;

  @Column()
  public name!: string;
}
`;

    const dbContext = `import 'reflect-metadata';
import { DbContext } from '@ts-linq/core';
import { SQLiteProvider } from '@ts-linq/sqlite';

export class AppDbContext extends DbContext {
  public constructor() {
    super({ provider: new SQLiteProvider(process.env.SQLITE_URL || 'file:app.db') });
  }
}
`;

    const envExample = `# Database provider: sqlite | postgresql | mysql | mssql
DB_PROVIDER=sqlite
SQLITE_URL=file:app.db
# POSTGRES_URL=postgres://user:pass@localhost:5432/db
# MYSQL_URL=mysql://user:pass@localhost:3306/db
# MSSQL_URL=mssql://user:pass@localhost:1433/db
`;

    writeFileIfMissing(path.join(dest, 'tsconfig.json'), tsconfig);
    writeFileIfMissing(path.join(dest, 'ts-linq.config.ts'), configTs);
    writeFileIfMissing(path.join(dest, '.env.example'), envExample);
    writeFileIfMissing(path.join(dest, 'src', 'entities', 'User.ts'), userEntity);
    writeFileIfMissing(path.join(dest, 'src', 'context', 'AppDbContext.ts'), dbContext);
    ensureDir(path.join(dest, 'migrations'));
    writeFileIfMissing(path.join(dest, 'migrations', '.gitkeep'), '');

    if (withMigration) {
      const name = 'Initial';
      const ts = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, '')
        .slice(0, 14);
      const migDir = path.join(dest, 'migrations');
      ensureDir(migDir);
      const migFile = path.join(migDir, `${ts}_${name}.ts`);
      const template = `import { Migration } from '@ts-linq/core';

export class ${name} extends Migration {
  protected get name() { return '${name}'; }
  protected get version() { return '${ts}'; }
  public async up(): Promise<void> { }
  public async down(): Promise<void> { }
}
`;
      writeFileIfMissing(migFile, template);
      console.log(`Created ${migFile}`);
    }

    console.log(`Initialized ts-linq project at ${dest}`);
    return Promise.resolve();
  }
}
