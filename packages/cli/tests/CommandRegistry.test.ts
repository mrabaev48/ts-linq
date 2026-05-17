import { CommandRegistry } from '../src/CommandRegistry';
import type { Command } from '../src/commands/Command';

describe('CommandRegistry', () => {
  const mk = (name: string, aliases?: string[]): Command => ({
    name,
    describe: `desc:${name}`,
    aliases,

    async run() {}
  });

  it('finds by name and alias; lists catalog', () => {
    const a = mk('alpha', ['a']);
    const b = mk('beta', ['b', 'be']);
    const reg = new CommandRegistry([a, b]);

    expect(reg.get('alpha')).toBe(a);
    expect(reg.get('a')).toBe(a);
    expect(reg.get('beta')).toBe(b);
    expect(reg.get('b')).toBe(b);
    expect(reg.get('be')).toBe(b);
    expect(reg.get('unknown')).toBeUndefined();

    const catalog = reg.listCatalog();
    expect(catalog).toEqual([
      { name: 'alpha', describe: 'desc:alpha', aliases: ['a'] },
      { name: 'beta', describe: 'desc:beta', aliases: ['b', 'be'] }
    ]);
  });
});
