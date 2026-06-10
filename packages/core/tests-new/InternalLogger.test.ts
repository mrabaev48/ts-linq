import {
  type InternalErrorHandler,
  logInternalError,
  setInternalErrorHandler
} from '../src/utils/InternalLogger';

describe('InternalLogger', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    // Always restore the silent Null Object default so handlers do not leak
    // across tests.
    setInternalErrorHandler(undefined);
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('default (Null Object) behaviour', () => {
    it('does not write to the console by default', () => {
      logInternalError('TestOperation', new Error('Test error'));
      logInternalError('TestOperation', 'string error');
      logInternalError('TestOperation', null);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('is a no-op when no handler is installed', () => {
      expect(() => logInternalError('Test', new Error('test'))).not.toThrow();
    });

    it('returns to silent after the handler is cleared', () => {
      const handler = jest.fn();
      setInternalErrorHandler(handler);
      logInternalError('Op1', new Error('error1'));
      expect(handler).toHaveBeenCalledTimes(1);

      setInternalErrorHandler(undefined);
      logInternalError('Op2', new Error('error2'));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('injected handler', () => {
    it('forwards context and error to the installed handler', () => {
      const handler = jest.fn<void, [string, unknown]>();
      setInternalErrorHandler(handler);

      const error = new Error('Test error');
      logInternalError('CustomOperation', error);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('CustomOperation', error);
    });

    it('forwards non-Error values verbatim', () => {
      const received: Array<[string, unknown]> = [];
      const handler: InternalErrorHandler = (context, error) => {
        received.push([context, error]);
      };
      setInternalErrorHandler(handler);

      logInternalError('StringOp', 'string error');
      logInternalError('NullOp', null);
      logInternalError('UndefinedOp', undefined);

      expect(received).toEqual([
        ['StringOp', 'string error'],
        ['NullOp', null],
        ['UndefinedOp', undefined]
      ]);
    });

    it('is safe to call multiple times', () => {
      const handler = jest.fn();
      setInternalErrorHandler(handler);

      logInternalError('Op1', new Error('error1'));
      logInternalError('Op2', new Error('error2'));

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('error safety', () => {
    it('never throws even if the handler throws', () => {
      setInternalErrorHandler(() => {
        throw new Error('handler boom');
      });

      expect(() => logInternalError('Test', new Error('test'))).not.toThrow();
    });

    it('does not surface handler failures to the caller', () => {
      const handler = jest.fn(() => {
        throw new Error('handler boom');
      });
      setInternalErrorHandler(handler);

      logInternalError('Test', new Error('test'));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
