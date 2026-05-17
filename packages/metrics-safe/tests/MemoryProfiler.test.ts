import { MemoryProfiler } from '../src/lib/MemoryProfiler';

describe('MemoryProfiler', () => {
  let profiler: MemoryProfiler;

  afterEach(() => {
    if (profiler) {
      profiler.stop();
    }
  });

  describe('construction', () => {
    it('should create profiler with default options', () => {
      profiler = new MemoryProfiler();

      expect(profiler).toBeInstanceOf(MemoryProfiler);
      expect(profiler.getSamples()).toEqual([]);
      expect(profiler.getAliveAllocations()).toBe(0);
    });

    it('should accept custom options', () => {
      profiler = new MemoryProfiler({
        sampleIntervalMs: 5000,
        enableGC: true,
        trackAllocations: true,
        maxSamples: 100
      });

      expect(profiler).toBeDefined();
    });
  });

  describe('basic methods', () => {
    it('should provide getSamples method', () => {
      profiler = new MemoryProfiler();

      expect(profiler.getSamples()).toEqual([]);
    });

    it('should provide getAliveAllocations method', () => {
      profiler = new MemoryProfiler({ trackAllocations: true });

      expect(profiler.getAliveAllocations()).toBe(0);
    });

    it('should track allocations', () => {
      profiler = new MemoryProfiler({ trackAllocations: true });

      const obj = profiler.trackAllocation({ id: 1 });

      expect(obj).toEqual({ id: 1 });
    });

    it('should handle start and stop', () => {
      profiler = new MemoryProfiler({ sampleIntervalMs: 1000 });

      expect(() => {
        profiler.start();
        profiler.stop();
      }).not.toThrow();
    });

    it('should handle onSample listener registration', () => {
      profiler = new MemoryProfiler();
      const listener = jest.fn();

      const unsubscribe = profiler.onSample(listener);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });
});
