import * as http from 'http';
import { describe, it, expect, afterEach } from '@jest/globals';
import { startPrometheusServer, getPrometheusMetrics } from '../src/utils/PrometheusEndpoint';

class FakeRegister {
  public contentType = 'text/plain; version=0.0.4; charset=utf-8';
  metrics(): string {
    return '# HELP test_metric Test metric\n# TYPE test_metric counter\ntest_metric 42';
  }
}

const fakeClient = { 
  register: new FakeRegister() 
} as { register: FakeRegister };

describe('Prometheus Endpoint Helpers', () => {
  let closeServer: (() => Promise<void>) | undefined;
  let lastHandler:
    | ((req: http.IncomingMessage, res: http.ServerResponse) => void)
    | undefined;

  afterEach(async () => {
    if (closeServer) {
      await closeServer();
      closeServer = undefined;
    }
    lastHandler = undefined;
  });

  it('should return body and contentType even without prom-client', async () => {
    const { contentType, body } = await getPrometheusMetrics(undefined);
    
    expect(typeof contentType).toBe('string');
    expect(typeof body).toBe('string');
    expect(body).toContain('prom-client');
  });

  it('should return metrics from prom-client register', async () => {
    const { contentType, body } = await getPrometheusMetrics(fakeClient);
    
    expect(contentType).toBe('text/plain; version=0.0.4; charset=utf-8');
    expect(body).toContain('test_metric');
    expect(body).toContain('42');
  });

  it('should serve /metrics endpoint with fake client', async () => {
    const fakeServer = (() => {
      const serverImpl = {
        once: (..._args: unknown[]) => serverImpl as unknown as http.Server,
        off: (..._args: unknown[]) => serverImpl as unknown as http.Server,
        listen: (...args: unknown[]) => {
          const last = args.length > 0 ? args[args.length - 1] : undefined;
          if (typeof last === 'function') (last as () => void)();
          return serverImpl as unknown as http.Server;
        },
        address: () => ({ port: 12345 } as unknown as ReturnType<http.Server['address']>),
        close: (...args: unknown[]) => {
          const last = args.length > 0 ? args[args.length - 1] : undefined;
          if (typeof last === 'function') (last as () => void)();
          return serverImpl as unknown as http.Server;
        }
      };
      return serverImpl as unknown as http.Server;
    })();

    const { server, port, close } = await startPrometheusServer({
      client: fakeClient,
      host: '127.0.0.1',
      port: 0,
      path: '/metrics',
      serverFactory: (handler) => {
        lastHandler = handler;
        return fakeServer as unknown as http.Server;
      }
    });

    closeServer = close;
    expect(server).toBeDefined();
    expect(port).toBe(12345);
    expect(lastHandler).toBeDefined();

    const resState: { statusCode: number; headers: Record<string, string>; body: string } = {
      statusCode: 0,
      headers: {},
      body: ''
    };
    const req = { url: '/metrics' } as unknown as http.IncomingMessage;
    const res = {
      get statusCode() {
        return resState.statusCode;
      },
      set statusCode(value: number) {
        resState.statusCode = value;
      },
      setHeader: (k: string, v: string) => {
        resState.headers[k] = v;
      },
      end: (chunk?: unknown) => {
        resState.body = String(chunk ?? '');
      }
    } as unknown as http.ServerResponse;

    lastHandler?.(req, res);
    await Promise.resolve();

    expect(resState.statusCode).toBe(200);
    expect(resState.headers['Content-Type']).toBe('text/plain; version=0.0.4; charset=utf-8');
    expect(resState.body).toContain('test_metric');
    expect(resState.body).toContain('42');
  });

  it('should serve metrics on custom path', async () => {
    const fakeServer = (() => {
      const serverImpl = {
        once: (..._args: unknown[]) => serverImpl as unknown as http.Server,
        off: (..._args: unknown[]) => serverImpl as unknown as http.Server,
        listen: (...args: unknown[]) => {
          const last = args.length > 0 ? args[args.length - 1] : undefined;
          if (typeof last === 'function') (last as () => void)();
          return serverImpl as unknown as http.Server;
        },
        address: () => ({ port: 12345 } as unknown as ReturnType<http.Server['address']>),
        close: (...args: unknown[]) => {
          const last = args.length > 0 ? args[args.length - 1] : undefined;
          if (typeof last === 'function') (last as () => void)();
          return serverImpl as unknown as http.Server;
        }
      };
      return serverImpl as unknown as http.Server;
    })();

    const { close } = await startPrometheusServer({
      client: fakeClient,
      host: '127.0.0.1',
      port: 0,
      path: '/custom/metrics',
      serverFactory: (handler) => {
        lastHandler = handler;
        return fakeServer as unknown as http.Server;
      }
    });

    closeServer = close;
    expect(lastHandler).toBeDefined();

    const resState: { statusCode: number; headers: Record<string, string>; body: string } = {
      statusCode: 0,
      headers: {},
      body: ''
    };
    const req = { url: '/custom/metrics' } as unknown as http.IncomingMessage;
    const res = {
      get statusCode() {
        return resState.statusCode;
      },
      set statusCode(value: number) {
        resState.statusCode = value;
      },
      setHeader: (k: string, v: string) => {
        resState.headers[k] = v;
      },
      end: (chunk?: unknown) => {
        resState.body = String(chunk ?? '');
      }
    } as unknown as http.ServerResponse;

    lastHandler?.(req, res);
    await Promise.resolve();

    expect(resState.statusCode).toBe(200);
    expect(resState.body).toContain('test_metric');
  });

  it('should return 404 for non-metrics paths', async () => {
    const fakeServer = (() => {
      const serverImpl = {
        once: (..._args: unknown[]) => serverImpl as unknown as http.Server,
        off: (..._args: unknown[]) => serverImpl as unknown as http.Server,
        listen: (...args: unknown[]) => {
          const last = args.length > 0 ? args[args.length - 1] : undefined;
          if (typeof last === 'function') (last as () => void)();
          return serverImpl as unknown as http.Server;
        },
        address: () => ({ port: 12345 } as unknown as ReturnType<http.Server['address']>),
        close: (...args: unknown[]) => {
          const last = args.length > 0 ? args[args.length - 1] : undefined;
          if (typeof last === 'function') (last as () => void)();
          return serverImpl as unknown as http.Server;
        }
      };
      return serverImpl as unknown as http.Server;
    })();

    const { close } = await startPrometheusServer({
      client: fakeClient,
      host: '127.0.0.1',
      port: 0,
      path: '/metrics',
      serverFactory: (handler) => {
        lastHandler = handler;
        return fakeServer as unknown as http.Server;
      }
    });

    closeServer = close;
    expect(lastHandler).toBeDefined();

    const resState: { statusCode: number; body: string } = { statusCode: 0, body: '' };
    const req = { url: '/other' } as unknown as http.IncomingMessage;
    const res = {
      get statusCode() {
        return resState.statusCode;
      },
      set statusCode(value: number) {
        resState.statusCode = value;
      },
      end: (chunk?: unknown) => {
        resState.body = String(chunk ?? '');
      }
    } as unknown as http.ServerResponse;

    lastHandler?.(req, res);

    expect(resState.statusCode).toBe(404);
    expect(resState.body).toBe('Not Found');
  });

  it('should handle server close gracefully', async () => {
    const closeSpy = jest.fn();
    const fakeServer = (() => {
      const serverImpl = {
        once: (..._args: unknown[]) => serverImpl as unknown as http.Server,
        off: (..._args: unknown[]) => serverImpl as unknown as http.Server,
        listen: (...args: unknown[]) => {
          const last = args.length > 0 ? args[args.length - 1] : undefined;
          if (typeof last === 'function') (last as () => void)();
          return serverImpl as unknown as http.Server;
        },
        address: () => ({ port: 12345 } as unknown as ReturnType<http.Server['address']>),
        close: (...args: unknown[]) => {
          closeSpy();
          const last = args.length > 0 ? args[args.length - 1] : undefined;
          if (typeof last === 'function') (last as () => void)();
          return serverImpl as unknown as http.Server;
        }
      };
      return serverImpl as unknown as http.Server;
    })();

    const { close } = await startPrometheusServer({
      client: fakeClient,
      host: '127.0.0.1',
      port: 0,
      path: '/metrics',
      serverFactory: (handler) => {
        lastHandler = handler;
        return fakeServer as unknown as http.Server;
      }
    });

    await close();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
