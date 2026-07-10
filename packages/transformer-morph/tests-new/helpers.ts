import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Minimal `@ts-linq/query` shim with the exact class/brand names the transformer
 * scope guards look for. Mirrors the fixture used by the transformer's own tests
 * so both packages exercise the same contract.
 */
export const QUERY_SHIM = [
  'export class Queryable<T> {',
  '  declare readonly __tsLinqWhereTransformerBrand: true;',
  '  public where(predicate: (entity: T) => boolean): Queryable<T> { void predicate; return this; }',
  '  public whereCompiled(input: { ast: unknown; parameters: readonly unknown[] }): Queryable<T> { void input; return this; }',
  '  public having(predicate: (entity: T) => boolean): Queryable<T> { void predicate; return this; }',
  '  public havingCompiled(input: { ast: unknown; parameters: readonly unknown[] }): Queryable<T> { void input; return this; }',
  '  public select<R>(selector: (entity: T) => R): Queryable<R> { void selector; return this as unknown as Queryable<R>; }',
  '  public selectCompiled<R>(input: { fields: readonly string[] }): Queryable<R> { void input; return this as unknown as Queryable<R>; }',
  '}',
  'export class TypedQueryable<T> {',
  '  declare readonly __tsLinqWhereTransformerBrand: true;',
  '  public where(predicate: (entity: T) => boolean): TypedQueryable<T> { void predicate; return this; }',
  '  public whereCompiled(input: { ast: unknown; parameters: readonly unknown[] }): TypedQueryable<T> { void input; return this; }',
  '}'
].join('\n');

export interface FixtureProject {
  readonly dir: string;
  readonly tsConfigFilePath: string;
  readonly consumerPath: string;
  readonly readOutput: (relativePath: string) => string;
}

/**
 * Creates an isolated on-disk project: a tsconfig, the `@ts-linq/query` shim
 * (mapped via `paths`) and a `consumer.ts` with the given source.
 */
export function createFixtureProject(consumerSource: string): FixtureProject {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-linq-transformer-morph-'));

  writeFile(path.join(dir, 'packages/query/src/index.ts'), QUERY_SHIM);
  const consumerPath = path.join(dir, 'consumer.ts');
  writeFile(consumerPath, consumerSource);

  const tsConfigFilePath = path.join(dir, 'tsconfig.json');
  writeFile(
    tsConfigFilePath,
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'CommonJS',
          strict: true,
          moduleResolution: 'node',
          baseUrl: '.',
          outDir: 'dist',
          skipLibCheck: true,
          types: [],
          paths: { '@ts-linq/query': ['packages/query/src/index.ts'] }
        },
        include: ['consumer.ts', 'packages/**/*.ts']
      },
      null,
      2
    )
  );

  return {
    dir,
    tsConfigFilePath,
    consumerPath,
    readOutput: (relativePath) => fs.readFileSync(path.join(dir, relativePath), 'utf8')
  };
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}
