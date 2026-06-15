import { describe, expect, it } from '@jest/globals';
import type { SequenceMetadata } from '@ts-linq/types';

import { SequenceExpander } from '../../../src/snapshot/expanders/schema/SequenceExpander';

describe('SequenceExpander', () => {
  const expander = new SequenceExpander();

  it('maps sequence metadata to snapshot defs, omitting undefined optional fields', () => {
    const sequences = [
      { name: 'order_seq', startsAt: 100, incrementsBy: 1 }
    ] as unknown as SequenceMetadata[];

    const defs = expander.expand(sequences);
    expect(defs).toEqual([{ name: 'order_seq', startsAt: 100, incrementsBy: 1 }]);
    // No `schema` / `type` / `cyclesOn` keys leak through as undefined.
    expect(Object.keys(defs[0])).toEqual(['name', 'startsAt', 'incrementsBy']);
  });

  it('reads only the injected list (no global registry)', () => {
    expect(expander.expand([])).toEqual([]);
  });
});
