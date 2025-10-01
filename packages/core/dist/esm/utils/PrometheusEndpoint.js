import * as http from 'http';
function safeRequirePromClient() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pc = require('prom-client');
        if (pc && pc.register && typeof pc.register.metrics === 'function')
            return pc;
    }
    catch {
        /* ignore */
    }
    return undefined;
}
export async function getPrometheusMetrics(client) {
    const pc = client ?? safeRequirePromClient();
    if (!pc) {
        return { contentType: 'text/plain; charset=utf-8', body: '# prom-client is not installed' };
    }
    const contentType = pc.register.contentType || 'text/plain; version=0.0.4; charset=utf-8';
    const res = pc.register.metrics();
    const body = typeof res === 'string' ? res : await res;
    return { contentType, body };
}
export async function startPrometheusServer(options) {
    const port = options?.port ?? 0;
    const path = options?.path ?? '/metrics';
    const client = options?.client;
    const server = http.createServer((req, res) => {
        if (req.url === path) {
            getPrometheusMetrics(client)
                .then(({ contentType, body }) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', contentType);
                res.end(body);
            })
                .catch((e) => {
                const message = e?.message || String(e);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end(`# metrics error: ${message}`);
            });
            return;
        }
        res.statusCode = 404;
        res.end('Not Found');
    });
    await new Promise((resolve) => server.listen(port, resolve));
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port || 0;
    const close = async () => await new Promise((resolve) => server.close(() => resolve()));
    return { server, port: actualPort, close };
}
//# sourceMappingURL=PrometheusEndpoint.js.map