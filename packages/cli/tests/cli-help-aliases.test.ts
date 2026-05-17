import { CommandRegistry } from '../src/CommandRegistry';
import type { Command } from '../src/commands/Command';

describe('cli help via registry', () => {
  it('lists catalog with aliases', () => {
    const mk = (name: string, describe: string, aliases?: string[]): Command => ({
      name,
      describe,
      aliases,

      async run() {}
    });
    const reg = new CommandRegistry([
      mk('schema:export', 'export', ['schema export']),
      mk('schema:diff', 'diff', ['schema diff'])
    ]);
    const cat = reg.listCatalog();
    expect(cat[0].aliases).toEqual(['schema export']);
    expect(cat[1].aliases).toEqual(['schema diff']);
  });
});
