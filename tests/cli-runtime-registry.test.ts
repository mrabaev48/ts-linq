import { CommandRegistry } from '../src/cli/runtime/registry';
import type { Command } from '../src/cli/runtime/command';

class DummyCommand implements Command {
  public async execute(): Promise<number> { return 42; }
}

describe('cli runtime CommandRegistry', () => {
  test('register/get works and returns handler', async () => {
    const reg = new CommandRegistry();
    const cmd = new DummyCommand();
    reg.register('dummy', cmd);
    const handler = reg.get('dummy');
    expect(handler).toBe(cmd);
    const code = await handler!.execute([], {});
    expect(code).toBe(42);
  });

  test('get unknown returns undefined', () => {
    const reg = new CommandRegistry();
    expect(reg.get('missing')).toBeUndefined();
  });
});


