import { describe, expect, it } from '@jest/globals';

import type { IDbCommandInterceptor } from '../src/interceptors/IDbCommandInterceptor';
import type { IDbConnectionInterceptor } from '../src/interceptors/IDbConnectionInterceptor';
import type { IDbTransactionInterceptor } from '../src/interceptors/IDbTransactionInterceptor';
import type { IMaterializationInterceptor } from '../src/interceptors/IMaterializationInterceptor';
import { InterceptionResult } from '../src/interceptors/InterceptionResult';
import { InterceptorDispatcher } from '../src/interceptors/InterceptorDispatcher';
import type { DbReader } from '../src/interceptors/types';

function emptyConfig(): Parameters<InterceptorDispatcher['configure']>[0] {
  return { command: [], connection: [], transaction: [], materialization: [] };
}

describe('InterceptorDispatcher', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('connection lifecycle', () => {
    it('calls each connection interceptor in registration order', async () => {
      const order: string[] = [];
      const a: IDbConnectionInterceptor = {
        connectionOpening: () => {
          order.push('a');
        }
      };
      const b: IDbConnectionInterceptor = {
        connectionOpening: () => {
          order.push('b');
        }
      };
      const d = new InterceptorDispatcher();
      d.configure({ ...emptyConfig(), connection: [a, b] });

      await d.connectionOpening();

      expect(order).toEqual(['a', 'b']);
    });

    it('isolates a throwing connection interceptor and surfaces it', async () => {
      const throwing: IDbConnectionInterceptor = {
        connectionClosed: () => {
          throw new Error('boom');
        }
      };
      const healthy: IDbConnectionInterceptor = { connectionClosed: jest.fn(() => {}) };
      const d = new InterceptorDispatcher();
      d.configure({ ...emptyConfig(), connection: [throwing, healthy] });

      await expect(d.connectionClosed()).resolves.toBeUndefined();
      expect(healthy.connectionClosed).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('transaction lifecycle', () => {
    it('passes the traceId to each transaction interceptor', async () => {
      const captured: Array<string | undefined> = [];
      const ic: IDbTransactionInterceptor = {
        transactionStarting: (ev) => {
          captured.push(ev.traceId);
        }
      };
      const d = new InterceptorDispatcher();
      d.configure({ ...emptyConfig(), transaction: [ic] });

      await d.transactionStarting('trace-1');

      expect(captured).toEqual(['trace-1']);
    });
  });

  describe('command lifecycle', () => {
    it('routes a SELECT to readerExecuting and others to nonQueryExecuting', async () => {
      const ic: IDbCommandInterceptor = {
        readerExecuting: jest.fn(() => InterceptionResult.NoResult<DbReader>()),
        nonQueryExecuting: jest.fn(() => InterceptionResult.NoResult<number>())
      };
      const d = new InterceptorDispatcher();
      d.configure({ ...emptyConfig(), command: [ic] });

      await d.commandExecuting('SELECT 1', []);
      await d.commandExecuting('UPDATE t SET a=1', []);

      expect(ic.readerExecuting).toHaveBeenCalledTimes(1);
      expect(ic.nonQueryExecuting).toHaveBeenCalledTimes(1);
    });

    it('propagates errors thrown during commandExecuting (can abort the command)', async () => {
      const ic: IDbCommandInterceptor = {
        readerExecuting: () => {
          throw new Error('veto');
        }
      };
      const d = new InterceptorDispatcher();
      d.configure({ ...emptyConfig(), command: [ic] });

      await expect(d.commandExecuting('SELECT 1', [])).rejects.toThrow('veto');
    });

    it('maps reader rows / affected count and isolates errors on commandExecuted', async () => {
      const seen: unknown[] = [];
      const ic: IDbCommandInterceptor = {
        readerExecuted: (_c, _e, reader) => {
          seen.push(reader.rows.length);
          throw new Error('post-boom');
        },
        nonQueryExecuted: (_c, _e, affected) => {
          seen.push(affected);
          return affected;
        }
      };
      const d = new InterceptorDispatcher();
      d.configure({ ...emptyConfig(), command: [ic] });

      await expect(
        d.commandExecuted('SELECT 1', [], undefined, 5, [{}, {}])
      ).resolves.toBeUndefined();
      await d.commandExecuted('DELETE FROM t', [], undefined, 1, 3);

      expect(seen).toEqual([2, 3]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('materialization', () => {
    it('runs interceptors in order, threading the replaced instance', async () => {
      const replacement = { replaced: true };
      const a: IMaterializationInterceptor = {
        initialized: (_ev, instance) => {
          (instance as Record<string, unknown>).a = true;
          return instance;
        }
      };
      const b: IMaterializationInterceptor = {
        initialized: () => replacement
      };
      const d = new InterceptorDispatcher();
      d.configure({ ...emptyConfig(), materialization: [a, b] });

      const original = {};
      const result = await d.entityMaterialized(original);

      expect(result).toBe(replacement);
    });

    it('returns the entity unchanged when no materialization interceptors are registered', async () => {
      const d = new InterceptorDispatcher();
      d.configure(emptyConfig());
      const entity = {};
      await expect(d.entityMaterialized(entity)).resolves.toBe(entity);
    });

    it('isolates a throwing materialization interceptor', async () => {
      const throwing: IMaterializationInterceptor = {
        initialized: () => {
          throw new Error('mat-boom');
        }
      };
      const d = new InterceptorDispatcher();
      d.configure({ ...emptyConfig(), materialization: [throwing] });
      const entity = {};

      await expect(d.entityMaterialized(entity)).resolves.toBe(entity);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
