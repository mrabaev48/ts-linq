import { logInternalError } from '../src/utils/InternalLogger';

describe('InternalLogger', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('logInternalError', () => {
    it('should log error with message', () => {
      const error = new Error('Test error');
      
      logInternalError('TestOperation', error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const callArgs = consoleErrorSpy.mock.calls[0];
      expect(callArgs[0]).toContain('TestOperation');
    });

    it('should handle string errors', () => {
      logInternalError('TestOperation', 'string error');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle null errors', () => {
      logInternalError('TestOperation', null);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle undefined errors', () => {
      logInternalError('TestOperation', undefined);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should include operation name in log', () => {
      logInternalError('CustomOperation', new Error('test'));

      const callArgs = consoleErrorSpy.mock.calls[0];
      expect(callArgs[0]).toContain('CustomOperation');
    });

    it('should log error with stack trace', () => {
      const error = new Error('Test error');
      
      logInternalError('TestOperation', error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const callArgs = consoleErrorSpy.mock.calls[0];
      expect(callArgs[0]).toContain('TestOperation');
      expect(callArgs[1]).toMatch(/Test error/);
    });

    it('should handle errors with custom properties', () => {
      const error = new Error('Test error') as any;
      error.code = 'ERR_CUSTOM';
      error.details = { foo: 'bar' };

      logInternalError('TestOperation', error);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Error logging behavior', () => {
    it('should never throw errors itself', () => {
      expect(() => logInternalError('Test', new Error('test'))).not.toThrow();
    });

    it('should handle console.error being unavailable', () => {
      consoleErrorSpy.mockRestore();
      const originalError = console.error;
      (console as any).error = undefined;

      expect(() => logInternalError('Test', new Error('test'))).not.toThrow();

      console.error = originalError;
    });

    it('should be safe to call multiple times', () => {
      logInternalError('Op1', new Error('error1'));
      logInternalError('Op2', new Error('error2'));

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });
  });
});
