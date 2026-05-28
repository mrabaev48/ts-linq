import { ValueConverter } from '../ValueConverter';

/** Converts Date to an ISO date string (YYYY-MM-DD) for storage as TEXT/VARCHAR. */
export const DateOnlyToStringConverter = new ValueConverter<Date, string>(
  (v) => v.toISOString().slice(0, 10),
  (v) => new Date(v)
);
