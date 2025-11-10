import { BatchExecutor } from '../src/batch/BatchExecutor';
import type { DatabaseProvider } from '../src/DatabaseProvider';

describe('BatchExecutor', () => {
  let mockProvider: any;
  let executor: BatchExecutor;

  beforeEach(() => {
    mockProvider = {
      _inTxn: false,
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      get inTransactionState() {
        return this._inTxn;
      }
    };

    executor = new BatchExecutor(mockProvider);
  });

  describe('inTxn()', () => {
    it('should execute function without transaction when useTransactions is false', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');

      const result = await executor.inTxn(false, mockFn);

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockProvider.beginTransaction).not.toHaveBeenCalled();
      expect(mockProvider.commitTransaction).not.toHaveBeenCalled();
    });

    it('should begin transaction when not already in one', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');

      const result = await executor.inTxn(true, mockFn);

      expect(result).toBe('result');
      expect(mockProvider.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should not begin transaction if already in transaction', async () => {
      mockProvider._inTxn = true;
      const mockFn = jest.fn().mockResolvedValue('result');

      const result = await executor.inTxn(true, mockFn);

      expect(result).toBe('result');
      expect(mockProvider.beginTransaction).not.toHaveBeenCalled();
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockProvider.commitTransaction).not.toHaveBeenCalled();
    });

    it('should rollback on error when transaction was started by this call', async () => {
      mockProvider._inTxn = false;
      mockProvider.beginTransaction.mockImplementation(async function(this: any) {
        this._inTxn = true;
      });
      
      const error = new Error('Test error');
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(executor.inTxn(true, mockFn)).rejects.toThrow('Test error');

      expect(mockProvider.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockProvider.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockProvider.commitTransaction).not.toHaveBeenCalled();
    });

    it('should not rollback if not in transaction when error occurs', async () => {
      const error = new Error('Test error');
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(executor.inTxn(false, mockFn)).rejects.toThrow('Test error');

      expect(mockProvider.beginTransaction).not.toHaveBeenCalled();
      expect(mockProvider.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('should rollback when already in transaction and error occurs', async () => {
      mockProvider._inTxn = true;
      const error = new Error('Test error');
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(executor.inTxn(true, mockFn)).rejects.toThrow('Test error');

      expect(mockProvider.beginTransaction).not.toHaveBeenCalled();
      expect(mockProvider.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('should return function result', async () => {
      const complexResult = { id: 1, data: 'test', nested: { value: 42 } };
      const mockFn = jest.fn().mockResolvedValue(complexResult);

      const result = await executor.inTxn(true, mockFn);

      expect(result).toEqual(complexResult);
      expect(result).toBe(complexResult);
    });
  });
});
