import type { SqlLogger, SqlLoggerFactory } from '@ts-linq/types';
import { CompositeSqlLoggerFactory } from '../src/logger/CompositeSqlLoggerFactory';
import { CompositeSqlLogger } from '../src/logger/CompositeSqlLogger';

describe('CompositeSqlLoggerFactory', () => {
  describe('Constructor', () => {
    it('should create factory with no options', () => {
      const factory = new CompositeSqlLoggerFactory();
      expect(factory).toBeDefined();
    });

    it('should create factory with factories option', () => {
      const mockFactory: SqlLoggerFactory = {
        create: jest.fn().mockReturnValue(createMockLogger())
      };
      const factory = new CompositeSqlLoggerFactory({ factories: [mockFactory] });
      expect(factory).toBeDefined();
    });

    it('should create factory with loggers option', () => {
      const mockLogger = createMockLogger();
      const factory = new CompositeSqlLoggerFactory({ loggers: [mockLogger] });
      expect(factory).toBeDefined();
    });

    it('should create factory with both factories and loggers', () => {
      const mockFactory: SqlLoggerFactory = {
        create: jest.fn().mockReturnValue(createMockLogger())
      };
      const mockLogger = createMockLogger();
      const factory = new CompositeSqlLoggerFactory({
        factories: [mockFactory],
        loggers: [mockLogger]
      });
      expect(factory).toBeDefined();
    });
  });

  describe('create() Method', () => {
    it('should return undefined when no factories or loggers', () => {
      const factory = new CompositeSqlLoggerFactory();
      const logger = factory.create('postgresql');
      expect(logger).toBeUndefined();
    });

    it('should create logger from static loggers', () => {
      const mockLogger = createMockLogger();
      const factory = new CompositeSqlLoggerFactory({ loggers: [mockLogger] });
      
      const logger = factory.create('postgresql');
      
      expect(logger).toBeInstanceOf(CompositeSqlLogger);
    });

    it('should call factory.create with provider name', () => {
      const mockFactory: SqlLoggerFactory = {
        create: jest.fn().mockReturnValue(createMockLogger())
      };
      const factory = new CompositeSqlLoggerFactory({ factories: [mockFactory] });
      
      factory.create('mysql');
      
      expect(mockFactory.create).toHaveBeenCalledWith('mysql');
    });

    it('should combine loggers from factories and static loggers', () => {
      const factoryLogger = createMockLogger();
      const mockFactory: SqlLoggerFactory = {
        create: jest.fn().mockReturnValue(factoryLogger)
      };
      const staticLogger = createMockLogger();
      
      const factory = new CompositeSqlLoggerFactory({
        factories: [mockFactory],
        loggers: [staticLogger]
      });
      
      const logger = factory.create('sqlite');
      
      expect(logger).toBeInstanceOf(CompositeSqlLogger);
      logger!.debug('test');
      expect(factoryLogger.debug).toHaveBeenCalled();
      expect(staticLogger.debug).toHaveBeenCalled();
    });

    it('should handle factory returning undefined', () => {
      const mockFactory: SqlLoggerFactory = {
        create: jest.fn().mockReturnValue(undefined)
      };
      const staticLogger = createMockLogger();
      
      const factory = new CompositeSqlLoggerFactory({
        factories: [mockFactory],
        loggers: [staticLogger]
      });
      
      const logger = factory.create('mssql');
      
      expect(logger).toBeInstanceOf(CompositeSqlLogger);
    });

    it('should handle factory throwing error', () => {
      const mockFactory: SqlLoggerFactory = {
        create: jest.fn().mockImplementation(() => { throw new Error('Factory error'); })
      };
      const staticLogger = createMockLogger();
      
      const factory = new CompositeSqlLoggerFactory({
        factories: [mockFactory],
        loggers: [staticLogger]
      });
      
      const logger = factory.create('postgresql');
      
      expect(logger).toBeInstanceOf(CompositeSqlLogger);
    });

    it('should filter out undefined factories', () => {
      const mockFactory: SqlLoggerFactory = {
        create: jest.fn().mockReturnValue(createMockLogger())
      };
      
      const factory = new CompositeSqlLoggerFactory({
        factories: [mockFactory, undefined]
      });
      
      const logger = factory.create('postgresql');
      expect(logger).toBeInstanceOf(CompositeSqlLogger);
    });

    it('should filter out undefined static loggers', () => {
      const mockLogger = createMockLogger();
      
      const factory = new CompositeSqlLoggerFactory({
        loggers: [mockLogger, undefined]
      });
      
      const logger = factory.create('mysql');
      expect(logger).toBeInstanceOf(CompositeSqlLogger);
    });
  });

  describe('Provider-specific behavior', () => {
    it('should pass different providers to factory', () => {
      const mockFactory: SqlLoggerFactory = {
        create: jest.fn().mockReturnValue(createMockLogger())
      };
      const factory = new CompositeSqlLoggerFactory({ factories: [mockFactory] });
      
      factory.create('sqlite');
      factory.create('postgresql');
      factory.create('mysql');
      factory.create('mssql');
      
      expect(mockFactory.create).toHaveBeenCalledWith('sqlite');
      expect(mockFactory.create).toHaveBeenCalledWith('postgresql');
      expect(mockFactory.create).toHaveBeenCalledWith('mysql');
      expect(mockFactory.create).toHaveBeenCalledWith('mssql');
    });

    it('should handle custom provider string', () => {
      const mockFactory: SqlLoggerFactory = {
        create: jest.fn().mockReturnValue(createMockLogger())
      };
      const factory = new CompositeSqlLoggerFactory({ factories: [mockFactory] });
      
      factory.create('custom-provider');
      
      expect(mockFactory.create).toHaveBeenCalledWith('custom-provider');
    });
  });
});

function createMockLogger(): jest.Mocked<SqlLogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    queryStart: jest.fn(),
    queryEnd: jest.fn(),
    retry: jest.fn(),
    transactionStart: jest.fn(),
    transactionEnd: jest.fn(),
    cache: jest.fn(),
    connectionHealth: jest.fn(),
    circuit: jest.fn(),
    fallback: jest.fn()
  };
}
