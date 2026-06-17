import { EntityEntry } from './EntityEntry';
import type { EntryFactory } from './EntryFactory';

/**
 * Default {@link EntryFactory} — constructs a concrete {@link EntityEntry}.
 *
 * Lives in its own module so the construction of `EntityEntry` is isolated from
 * `ChangeTracker`; the dependency direction is one-way
 * (`ChangeTracker → defaultEntryFactory → EntityEntry`), with no edge back to the
 * tracker (see {@link IChangeTrackerForEntry}). Override via
 * `ChangeTracker.setEntryFactory` for testing / custom entry types.
 */
export const defaultEntryFactory: EntryFactory = (entity, entityClass, provider, tracker) =>
  new EntityEntry(entity, entityClass, provider, tracker);
