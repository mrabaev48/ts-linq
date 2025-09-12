import 'reflect-metadata';
import { startPrometheusServer, getPrometheusMetrics } from '../src/utils/PrometheusEndpoint';

class FakeRegister {
  public contentType = 'text/plain; version=0.0.4; charset=utf-8';
  metrics(): string {
    return '# HELP test 1\n# TYPE test counter\ntest 1';
  }
}
const fakeClient = { register: new FakeRegister() } as { register: FakeRegister };

describe('Prometheus endpoint helpers', () => {
  it('getPrometheusMetrics returns body and contentType even without prom-client', async () => {
    const { contentType, body } = await getPrometheusMetrics(undefined);
    expect(typeof contentType).toBe('string');
    expect(typeof body).toBe('string');
  });

  it('startPrometheusServer serves /metrics with fake client', async () => {
    const { server, port, close } = await startPrometheusServer({
      client: fakeClient,
      port: 0,
      path: '/metrics'
    });
    const res = await fetch(`http://127.0.0.1:${port}/metrics`);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text.includes('test')).toBe(true);
    await close();
  });
});
