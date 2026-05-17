import type { DatabaseProvider } from '@ts-linq/core';

import { CommandRegistry } from '../src/CommandRegistry';
import type { Command, DbCommand } from '../src/commands/Command';

class Prov implements Partial<DatabaseProvider> {
  public connected = false;
  public async connect(): Promise<void> {
    this.connected = true;
  }
  public async disconnect(): Promise<void> {
    this.connected = false;
  }
}

it('dispatches to run for Command and to runDb for DbCommand', async () => {
  const calls: string[] = [];
  const simple: Command = {
    name: 'simple',
    describe: 'simple',
    async run(argv: string[]): Promise<void> {
      calls.push(`run:${argv[0]}`);
    }
  };
  const db: DbCommand = {
    name: 'db',
    describe: 'db',
    async runDb(_p: any, argv: string[]): Promise<void> {
      calls.push(`runDb:${argv[0]}`);
    }
  };
  const reg = new CommandRegistry([simple, db]);
  const s = reg.get('simple') as Command;
  await s.run(['simple']);
  const d = reg.get('db') as DbCommand;
  await d.runDb(new Prov() as unknown as DatabaseProvider, ['db']);
  expect(calls).toEqual(['run:simple', 'runDb:db']);
});
