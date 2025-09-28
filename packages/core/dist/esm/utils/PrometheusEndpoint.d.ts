import * as http from 'http';
interface PromClientRegisterLike {
  contentType: string;
  metrics: () => Promise<string> | string;
}
interface PromClientWithRegisterLike {
  register: PromClientRegisterLike;
}
export declare function getPrometheusMetrics(client?: PromClientWithRegisterLike): Promise<{
  contentType: string;
  body: string;
}>;
export declare function startPrometheusServer(options?: {
  port?: number;
  path?: string;
  client?: PromClientWithRegisterLike;
}): Promise<{
  server: http.Server;
  port: number;
  close: () => Promise<void>;
}>;
export {};
//# sourceMappingURL=PrometheusEndpoint.d.ts.map
