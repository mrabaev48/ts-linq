import { describe, expect, it } from '@jest/globals';

import { EF } from '../src/EF';
import { efFunctions } from '../src/EF.functions';

describe('EF.functions — marker object', () => {
  it('EF.functions is frozen', () => {
    expect(Object.isFrozen(efFunctions)).toBe(true);
  });

  it('EF.functions is accessible via EF.functions', () => {
    expect(EF.functions).toBe(efFunctions);
  });

  it('like() throws outside LINQ context', () => {
    expect(() => EF.functions.like('col', '%pattern%')).toThrow(
      'EF.functions.like() can only be used inside a compiled LINQ expression'
    );
  });

  it('iLike() throws outside LINQ context', () => {
    expect(() => EF.functions.iLike('col', '%pattern%')).toThrow('iLike');
  });

  it('random() throws outside LINQ context', () => {
    expect(() => EF.functions.random()).toThrow('random');
  });

  it('dateDiffDay() throws outside LINQ context', () => {
    expect(() => EF.functions.dateDiffDay(new Date(), new Date())).toThrow('dateDiffDay');
  });

  it('dateDiffMonth() throws outside LINQ context', () => {
    expect(() => EF.functions.dateDiffMonth(new Date(), new Date())).toThrow('dateDiffMonth');
  });

  it('greatest() throws outside LINQ context', () => {
    expect(() => EF.functions.greatest(1, 2, 3)).toThrow('greatest');
  });

  it('least() throws outside LINQ context', () => {
    expect(() => EF.functions.least(1, 2, 3)).toThrow('least');
  });

  it('stDev() throws outside LINQ context', () => {
    expect(() => EF.functions.stDev(0)).toThrow('stDev');
  });

  it('variance() throws outside LINQ context', () => {
    expect(() => EF.functions.variance(0)).toThrow('variance');
  });
});
