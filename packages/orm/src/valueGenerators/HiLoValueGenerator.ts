import type { ValueGenerator, ValueGeneratorContext } from '@ts-linq/types';

/**
 * Callback type for reserving the next Hi-Lo block from the database.
 *
 * @public — a user-implemented callback exported from `@ts-linq/orm` so consumers can type their
 * block-fetch function. It is independent of the concrete {@link HiLoValueGenerator} class, which
 * is an implementation detail behind `@ts-linq/orm/internal`. Keeping the type public while the
 * class is internal is deliberate (orm/task-6, confirmed orm/task-6.1 item 2).
 */
export type FetchNextHiLoBlock = (
  sequenceName: string,
  schema: string | undefined,
  blockSize: number
) => Promise<number>;

/**
 * Hi-Lo value generator: reserves a block of IDs in a single round-trip and assigns
 * them in-memory until the block is exhausted, then fetches the next block.
 *
 * This class is stateful and must be held per-DbContext (not shared across contexts).
 * The `fetchNextBlock` callback performs the actual database call.
 *
 * EF Core reference: HiLoSequenceValueGenerator.
 */
export class HiLoValueGenerator implements ValueGenerator<number> {
  private _lo = 0;
  private _hi = -1;

  constructor(
    private readonly sequenceName: string,
    private readonly schema: string | undefined,
    private readonly blockSize: number,
    private readonly fetchNextBlock: FetchNextHiLoBlock
  ) {
    if (blockSize < 1) throw new RangeError('HiLo blockSize must be >= 1');
  }

  /**
   * Returns the next ID synchronously if a reserved block is available.
   * When called synchronously this throws if the block is exhausted — callers
   * must call ensureBlock() first when operating in async contexts.
   */
  next(_ctx: ValueGeneratorContext): number {
    if (this._lo > this._hi) {
      throw new Error(
        `HiLoValueGenerator: block exhausted for sequence "${this.sequenceName}". ` +
          'Call ensureBlock() before next() in async contexts.'
      );
    }
    return this._lo++;
  }

  /**
   * Ensures a block is reserved. Must be called (and awaited) before next()
   * when the generator is used in an async pipeline (e.g. SaveChanges).
   */
  async ensureBlock(): Promise<void> {
    if (this._lo <= this._hi) return;
    const hiValue = await this.fetchNextBlock(this.sequenceName, this.schema, this.blockSize);
    this._hi = hiValue;
    this._lo = hiValue - this.blockSize + 1;
  }

  /** @internal — for testing only */
  _blockState(): { lo: number; hi: number } {
    return { lo: this._lo, hi: this._hi };
  }
}
