import * as http from 'http';

interface PromClientRegisterLike {
    contentType: string;
    metrics: () => Promise<string> | string;
}

interface PromClientWithRegisterLike {
    register: PromClientRegisterLike;
}

function safeRequirePromClient(): PromClientWithRegisterLike | undefined {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pc = require('prom-client');
        if (pc && pc.register && typeof pc.register.metrics === 'function') return pc as PromClientWithRegisterLike;
    } catch { /* ignore */ }
    return undefined;
}

export async function getPrometheusMetrics(client?: PromClientWithRegisterLike): Promise<{ contentType: string; body: string }> {
    const pc = client ?? safeRequirePromClient();
    if (!pc) {
        return { contentType: 'text/plain; charset=utf-8', body: '# prom-client is not installed' };
    }
    const contentType = pc.register.contentType || 'text/plain; version=0.0.4; charset=utf-8';
    const res = pc.register.metrics();
    const body = typeof res === 'string' ? res : await res;
    return { contentType, body };
}

export async function startPrometheusServer(options?: { port?: number; path?: string; client?: PromClientWithRegisterLike }): Promise<{ server: http.Server; port: number; close: () => Promise<void> }>{
    const port = options?.port ?? 0;
    const path = options?.path ?? '/metrics';
    const client = options?.client;
    const server = http.createServer(async (req, res) => {
        if (req.url === path) {
            try {
                const { contentType, body } = await getPrometheusMetrics(client);
                res.statusCode = 200;
                res.setHeader('Content-Type', contentType);
                res.end(body);
            } catch (e: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end(`# metrics error: ${e?.message || String(e)}`);
            }
            return;
        }
        res.statusCode = 404;
        res.end('Not Found');
    });
    await new Promise<void>((resolve) => server.listen(port, resolve));
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? (address.port as number) : (port || 0);
    const close = async () => await new Promise<void>((resolve) => server.close(() => resolve()));
    return { server, port: actualPort, close };
}


