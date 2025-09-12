import * as path from 'path';
import type { Command } from '../runtime/command';
import type { Flags } from '../runtime/types';
import { NodeFsPort, ConsoleLogger } from '../runtime/nodeAdapters';

export class GenerateEntityCommand implements Command {
  public async execute(rest: string[], flags: Flags): Promise<number> {
    const rawName = rest[0] === 'entity' ? rest[1] : rest[0];
    const nameArg = (rawName || 'Entity').replace(/\s+/g, '_');
    const cwd = flags.cwd || process.cwd();
    const logger = new ConsoleLogger();
    const fsp = new NodeFsPort();
    const targetDir = flags.dir
      ? path.resolve(cwd, flags.dir)
      : path.resolve(cwd, 'src', 'entities');
    fsp.mkdirp(targetDir);
    const file = path.join(targetDir, `${nameArg}.ts`);
    const { pkLine, columnLines } = buildColumns(flags);
    const template = `import 'reflect-metadata';
import { Entity } from '../../decorators/Entity';
import { PrimaryKey } from '../../decorators/PrimaryKey';
import { Column } from '../../decorators/Column';

@Entity()
export class ${nameArg} {
${pkLine}
${columnLines}
}
`;
    fsp.writeText(file, template);
    if (!flags.quiet) logger.log('info', `Created ${file}`);
    return 0;
  }
}

function buildColumns(flags: Flags): { pkLine: string; columnLines: string } {
  const primaryKeyName = flags.pk && flags.pk.trim() ? flags.pk.trim() : 'id';
  const pkLine = `  @PrimaryKey()\n  public ${primaryKeyName}!: number;`;
  const cols = parseColumns(flags.columns);
  const lines = cols
    .map((c) => {
      const typeMap: Record<string, string> = {
        string: "TEXT",
        number: "INTEGER",
        boolean: "INTEGER"
      };
      const sqlType = typeMap[c.type] ?? 'TEXT';
      return `  @Column({ type: '${sqlType}', nullable: ${c.nullable ? 'true' : 'false'} })\n  public ${c.name}!: ${c.type};`;
    })
    .join('\n\n');
  return { pkLine, columnLines: lines || `  @Column({ type: 'TEXT', nullable: false })\n  public name!: string;` };
}

function parseColumns(spec?: string): Array<{ name: string; type: 'string' | 'number' | 'boolean'; nullable: boolean }> {
  if (!spec || !spec.trim()) return [];
  return spec.split(',').map((raw) => {
    const [name, typeRaw] = raw.split(':');
    const t = (typeRaw || 'string').trim();
    const nullable = t.endsWith('?');
    const base = (nullable ? t.slice(0, -1) : t) as 'string' | 'number' | 'boolean';
    return { name: name.trim(), type: base, nullable };
  });
}


