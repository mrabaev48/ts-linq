import { numberPlaceholders } from '@ts-linq/dialect-kit';

describe('numberPlaceholders', () => {
  it('renumbers `?` markers into PostgreSQL $N style', () => {
    expect(numberPlaceholders('INSERT INTO t (a,b) VALUES (?,?)', '$')).toBe(
      'INSERT INTO t (a,b) VALUES ($1,$2)'
    );
  });

  it('renumbers `?` markers into SQL Server @pN style', () => {
    expect(numberPlaceholders('WHERE a = ? AND b = ?', '@p')).toBe('WHERE a = @p1 AND b = @p2');
  });

  it('numbers left-to-right across the whole string', () => {
    expect(numberPlaceholders('? ? ? ?', '$')).toBe('$1 $2 $3 $4');
  });

  it('returns the string unchanged when there are no placeholders', () => {
    expect(numberPlaceholders('SELECT 1', '@p')).toBe('SELECT 1');
    expect(numberPlaceholders('', '$')).toBe('');
  });
});
