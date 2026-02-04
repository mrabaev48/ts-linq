import type { ConnectionHealthCheckOptions, SqlLogger } from '@ts-linq/types';
import type { ResilienceManager } from '../Resilience/ResilienceManager';

export class HealthMonitor {
  private healthTimer?: ReturnType<typeof setInterval>;
  private healthFailures: number = 0;
  private healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  constructor(
    private readonly logger?: SqlLogger,
    private readonly providerName: string = 'unknown',
    private options?: ConnectionHealthCheckOptions,
    private readonly resilienceManager?: ResilienceManager
  ) {}

  public configure(options: ConnectionHealthCheckOptions): void {
    this.options = { ...this.options, ...options };
    // Restart if running? We will leave it to caller to restart if needed, or implement improved logic later
  }

  public start(runPing: () => Promise<number>): void {
    if (!this.options?.enabled) return;
    
    const minI = this.options.minIntervalMs ?? this.options.intervalMs ?? 60000;
    const maxI = this.options.maxIntervalMs ?? Math.max(minI * 4, 60000);
    const degradeN = this.options.degradeAfterFailures ?? 3;
    const unhealthyN = this.options.unhealthyAfterFailures ?? 6;

    const scheduleNext = (delay: number) => {
      if (this.healthTimer) clearInterval(this.healthTimer);
      this.healthTimer = setInterval(() => {
        void runOnce();
      }, delay);
    };

    const runOnce = async () => {
      try {
        const timeoutMs = this.options?.timeoutMs;
        const started = Date.now();
        const pingPromise = runPing();
        
        const timed =
          typeof timeoutMs === 'number' && timeoutMs > 0
            ? Promise.race([
                pingPromise,
                new Promise<number>((_, rej) =>
                  setTimeout(() => rej(new Error('health-timeout')), timeoutMs)
                )
              ])
            : pingPromise;
            
        const latency = await timed;
        const elapsed = latency ?? Date.now() - started;
        
        this.healthFailures = 0;
        this.healthStatus = 'healthy';
        
        this.logger?.connectionHealth?.({
          healthy: true,
          latencyMs: elapsed,
          provider: this.providerName,
          status: this.healthStatus
        });

        // If previously unhealthy opened circuit, close when back to healthy
        if (this.resilienceManager?.state !== 'closed') {
          this.resilienceManager?.transitionCircuit('closed', 'health restored');
        }

        scheduleNext(minI);
      } catch {
        this.healthFailures += 1;
        this.healthStatus =
          this.healthFailures >= unhealthyN
            ? 'unhealthy'
            : this.healthFailures >= degradeN
              ? 'degraded'
              : 'healthy';
              
        this.logger?.connectionHealth?.({
          healthy: false,
          provider: this.providerName,
          status: this.healthStatus
        });

        // Auto-open circuit when unhealthy
        if (this.healthStatus === 'unhealthy') {
          // We can't access private openCircuit directly, but we can potentially force it or use a public method
          // Assuming ResilienceManager exposes transitionCircuit or forceOpen
           this.resilienceManager?.forceOpen('health unhealthy'); 
        }

        // Exponential backoff within [minI, maxI]
        const attempt = Math.min(this.healthFailures, 10);
        const base = Math.min(minI * Math.pow(2, attempt - 1), maxI);
        const jitter = Math.floor(Math.random() * Math.floor(base * 0.1));
        const next = Math.min(base + jitter, maxI);
        
        scheduleNext(next);
      }
    };

    scheduleNext(minI);
    // Run first check immediately (non-blocking)
    void (async () => {
      await runOnce();
    })();
  }

  public stop(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = undefined;
    }
  }
}
