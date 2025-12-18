import { logInternalError } from '../src/InternalLogger';

describe('logInternalError', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log Error with stack trace', () => {
    const error = new Error('Test error');
    logInternalError('TestContext', error);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[ts-linq internal] TestContext',
      expect.stringContaining('Test error')
    );
  });

  it('should log Error with message when no stack', () => {
    const error = new Error('No stack');
    error.stack = undefined;
    logInternalError('NoStack', error);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[ts-linq internal] NoStack',
      'No stack'
    );
  });

  it('should log non-Error values as strings', () => {
    logInternalError('StringError', 'plain string error');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[ts-linq internal] StringError',
      'plain string error'
    );
  });

  it('should handle object errors', () => {
    logInternalError('ObjectError', { code: 'ERR_001' });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[ts-linq internal] ObjectError',
      '[object Object]'
    );
  });

  it('should handle null error', () => {
    logInternalError('NullError', null);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[ts-linq internal] NullError',
      'null'
    );
  });

  it('should handle undefined error', () => {
    logInternalError('UndefinedError', undefined);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[ts-linq internal] UndefinedError',
      'undefined'
    );
  });

  it('should not throw when console.error throws', () => {
    consoleSpy.mockImplementation(() => { throw new Error('console broken'); });
    
    expect(() => logInternalError('SafeContext', new Error('test'))).not.toThrow();
  });

  it('should include context in prefix', () => {
    logInternalError('DatabaseQuery', new Error('timeout'));
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[ts-linq internal] DatabaseQuery',
      expect.any(String)
    );
  });
});
