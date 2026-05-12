import { TestProvider } from '@ts-linq/testkits';
import { DatabaseError } from '@ts-linq/types';
import { CircuitOpenError } from '@ts-linq/core';

class FaultyProvider extends TestProvider {
    public shouldFail = false;
    public failMessage = 'Connection timeout';

    constructor(config: any) {
        super(config);
    }

    public async doExecuteQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
        if (this.shouldFail) throw new DatabaseError(this.failMessage);
        return super.doExecuteQuery(sql, params);
    }
}

describe('Telemetry Integration - Circuit Breaker', () => {
  let provider: FaultyProvider;

  beforeEach(async () => {
    provider = new FaultyProvider({
        file: ':memory:',
        circuit: { 
            enabled: true,
            failureThreshold: 3,
            openDurationMs: 1000 // default is 30s, make it shorter for tests
        }
    });
    await provider.connect();
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  it('should open circuit after failure threshold reached', async () => {
    provider.shouldFail = true;

    // Fail 1
    await expect(provider.executeQuery('SELECT 1')).rejects.toThrow(DatabaseError);
    expect(provider.circuitStateLabel).toBe('closed');

    // Fail 2
    await expect(provider.executeQuery('SELECT 1')).rejects.toThrow(DatabaseError);
    expect(provider.circuitStateLabel).toBe('closed');

    // Fail 3 -> Open (The 3rd failure triggers the open state)
    await expect(provider.executeQuery('SELECT 1')).rejects.toThrow(DatabaseError);
    
    // Next call should be CircuitOpenError
    await expect(provider.executeQuery('SELECT 1')).rejects.toBeInstanceOf(CircuitOpenError);
    expect(provider.circuitStateLabel).toBe('open');
  });

  it('should reject requests fast when open', async () => {
      provider.forceOpen('test');
      expect(provider.circuitStateLabel).toBe('open');

      const start = Date.now();
      await expect(provider.executeQuery('SELECT 1')).rejects.toBeInstanceOf(CircuitOpenError);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(20); // Should be very fast
  });

  it('should transition to half-open after cooldown', async () => {
      // Configure with short open duration for this test
      provider.configureCircuit({ openDurationMs: 50 });
      provider.forceOpen('test'); 
      expect(provider.circuitStateLabel).toBe('open');

      await new Promise(r => setTimeout(r, 60));

      // Attempt triggers state check -> moves to half-open -> executes
      // We make sure it succeeds
      provider.shouldFail = false;
      await provider.executeQuery('SELECT 1');
      
      // Success should close it
      expect(provider.circuitStateLabel).toBe('closed');
  });

  it('should re-open if half-open probe fails', async () => {
      provider.configureCircuit({ openDurationMs: 50 });
      provider.forceOpen('test');
      await new Promise(r => setTimeout(r, 60));

      // Next call attempts half-open
      provider.shouldFail = true;
      await expect(provider.executeQuery('SELECT 1')).rejects.toThrow(DatabaseError);

      // Should be open again
      expect(provider.circuitStateLabel).toBe('open');
  });
});
