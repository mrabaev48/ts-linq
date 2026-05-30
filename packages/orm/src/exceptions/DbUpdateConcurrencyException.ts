import type { EntityEntry } from '../changetracker/EntityEntry';

export class DbUpdateConcurrencyException extends Error {
  readonly entries: EntityEntry[];

  constructor(message: string, entries: EntityEntry[]) {
    super(message);
    this.name = 'DbUpdateConcurrencyException';
    this.entries = entries;
  }
}
