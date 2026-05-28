import { ValueConverter } from '../ValueConverter';

/** Converts boolean model values to 0/1 for databases that store booleans as integers. */
export const BoolToZeroOneConverter = new ValueConverter<boolean, number>(
  (v) => (v ? 1 : 0),
  (v) => v !== 0
);
