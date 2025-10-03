"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrometheusMetrics = getPrometheusMetrics;
exports.startPrometheusServer = startPrometheusServer;
const http = __importStar(require("http"));
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
async function getPrometheusMetrics(client) {
    const pc = client ?? safeRequirePromClient();
    if (!pc) {
        return { contentType: 'text/plain; charset=utf-8', body: '# prom-client is not installed' };
    }
    const contentType = pc.register.contentType || 'text/plain; version=0.0.4; charset=utf-8';
    const res = pc.register.metrics();
    const body = typeof res === 'string' ? res : await res;
    return { contentType, body };
}
async function startPrometheusServer(options) {
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