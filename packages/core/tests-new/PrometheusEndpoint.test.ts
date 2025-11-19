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

  afterEach(async () => {
    if (closeServer) {
      await closeServer();
      closeServer = undefined;
    }
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
    const { server, port, close } = await startPrometheusServer({
      client: fakeClient,
      port: 0, // Random available port
      path: '/metrics'
    });

    closeServer = close;

    expect(server).toBeDefined();
    expect(port).toBeGreaterThan(0);

    const res = await fetch(`http://127.0.0.1:${port}/metrics`);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toContain('test_metric');
    expect(text).toContain('42');
  });

  it('should serve metrics on custom path', async () => {
    const { server, port, close } = await startPrometheusServer({
      client: fakeClient,
      port: 0,
      path: '/custom/metrics'
    });

    closeServer = close;

    const res = await fetch(`http://127.0.0.1:${port}/custom/metrics`);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toContain('test_metric');
  });

  it('should return 404 for non-metrics paths', async () => {
    const { server, port, close } = await startPrometheusServer({
      client: fakeClient,
      port: 0,
      path: '/metrics'
    });

    closeServer = close;

    const res = await fetch(`http://127.0.0.1:${port}/other`);

    expect(res.status).toBe(404);
  });

  it('should handle server close gracefully', async () => {
    const { server, port, close } = await startPrometheusServer({
      client: fakeClient,
      port: 0,
      path: '/metrics'
    });

    // First request should succeed
    const res1 = await fetch(`http://127.0.0.1:${port}/metrics`);
    expect(res1.status).toBe(200);

    // Close server
    await close();

    // Second request should fail
    await expect(
      fetch(`http://127.0.0.1:${port}/metrics`)
    ).rejects.toThrow();
  });
});
