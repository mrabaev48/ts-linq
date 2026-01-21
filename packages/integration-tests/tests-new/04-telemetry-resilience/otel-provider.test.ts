
import { TestProvider } from '@ts-linq/testkits';

// Mock artifacts
const mockSpan = {
  setAttribute: jest.fn(),
  recordException: jest.fn(),
  setStatus: jest.fn(),
  end: jest.fn()
};
const mockTracer = {
  startSpan: jest.fn(() => mockSpan)
};
const mockOtel = {
  trace: {
    getTracer: jest.fn(() => mockTracer)
  }
};

// Virtual mock for optional peer dependency
jest.mock('@opentelemetry/api', () => mockOtel, { virtual: true });

import { OpenTelemetrySqlLogger } from '@ts-linq/open-telemetry-sql-logger';
import { DbContext } from '@ts-linq/orm';
import { Entity, PrimaryKey, Column } from '@ts-linq/metadata';

@Entity({ name: 'otel_data' })
class Data {
  @PrimaryKey({ autoIncrement: true })
  id!: number;
  @Column()
  value!: string;
}

class TestContext extends DbContext {}

describe('Telemetry Integration - OpenTelemetry + Provider', () => {
  let logger: OpenTelemetrySqlLogger;
  let provider: TestProvider;
  let context: TestContext;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    logger = new OpenTelemetrySqlLogger('test-service');
    provider = new TestProvider(':memory:');
    // Manually attach logger if needed or rely on provider internals if implemented
    (provider as any).logger = logger;
    context = new TestContext({ provider });
    await context.ensureCreated();
  });

  afterEach(async () => {
    await context.dispose();
  });

  it('should start a span for SQL queries', async () => {
    // Act
    const set = context.set(Data);
    set.add({ value: 'test' } as Data);
    await context.saveChanges();

    // Assert
    expect(mockOtel.trace.getTracer).toHaveBeenCalledWith('test-service');
    expect(mockTracer.startSpan).toHaveBeenCalledWith('db.query', expect.objectContaining({
        attributes: expect.objectContaining({
            'db.system': 'test',
            'db.statement': expect.stringContaining('INSERT')
        })
    }));
  });

  it('should end the span and record duration', async () => {
      await context.set(Data).toArray();
      
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('db.duration_ms', expect.any(Number));
      expect(mockSpan.end).toHaveBeenCalled();
  });

  it('should record exceptions on error', async () => {
    try {
        await provider.executeQuery('SELECT * FROM bad_table');
    } catch { 
        // ignore 
    }

    expect(mockSpan.recordException).toHaveBeenCalled();
    expect(mockSpan.setStatus).toHaveBeenCalledWith(expect.objectContaining({ code: 2 }));
    expect(mockSpan.end).toHaveBeenCalled();
  });
});
