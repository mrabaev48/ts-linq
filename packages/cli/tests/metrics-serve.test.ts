import type { MetricsServeCommand } from '../src/commands/MetricsServeCommand';

describe('CLI metrics:serve', () => {
  it('parses arguments and starts server (smoke)', async () => {
    // Arrange: stub startPrometheusServer to avoid real network
    const started: { port?: number; path?: string }[] = [];
    jest.mock('@ts-linq/core', () => ({
      __esModule: true,
      startPrometheusServer: async ({ port, path }: { port?: number; path?: string }) => {
        started.push({ port, path });
        return {
          server: { on: (_: string, __: () => void) => {} } as unknown as import('http').Server,
          port: port ?? 0,
          close: async () => {}
        };
      }
    }));
    // Dynamically require after mocking
    const { MetricsServeCommand: Cmd } = require('../src/commands/MetricsServeCommand') as {
      MetricsServeCommand: typeof MetricsServeCommand;
    };
    const cmd = new Cmd({
      info: () => {},
      warn: () => {},
      error: () => {}
    });

    // Act
    await cmd.run(['metrics:serve', '--port', '12345', '--path', '/m']);

    // Assert
    expect(started.length).toBe(1);
    expect(started[0]).toEqual({ port: 12345, path: '/m' });
  });
});
