import type { SequenceMetadata } from '@ts-linq/types';

import type { SequenceDef } from '../../../DiffTypes';

/**
 * Maps declared sequences (P1-21) into snapshot {@link SequenceDef} entries.
 *
 * Operates on the injected sequence list — it never reads the global
 * `SequenceRegistry` — so it is unit-testable in isolation.
 */
export class SequenceExpander {
  public expand(sequences: ReadonlyArray<SequenceMetadata>): SequenceDef[] {
    return sequences.map((s) => ({
      name: s.name,
      ...(s.schema !== undefined ? { schema: s.schema } : {}),
      ...(s.type !== undefined ? { type: s.type } : {}),
      ...(s.startsAt !== undefined ? { startsAt: s.startsAt } : {}),
      ...(s.incrementsBy !== undefined ? { incrementsBy: s.incrementsBy } : {}),
      ...(s.minValue !== undefined ? { minValue: s.minValue } : {}),
      ...(s.maxValue !== undefined ? { maxValue: s.maxValue } : {}),
      ...(s.cyclesOn !== undefined ? { cyclesOn: s.cyclesOn } : {})
    }));
  }
}
