import type { ValueGenerator, ValueGeneratorContext } from '@ts-linq/types';

export class UtcNowValueGenerator implements ValueGenerator<Date> {
  next(_context: ValueGeneratorContext): Date {
    return new Date();
  }
}
