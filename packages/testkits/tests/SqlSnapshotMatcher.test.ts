import { SqlSnapshotMatcher, setupSqlSnapshotMatchers } from '../src/snapshot/SqlSnapshotMatcher';

describe('SqlSnapshotMatcher', () => {
  describe('normalize()', () => {
    it('should normalize whitespace by default', () => {
      const sql = `SELECT  *  
        FROM   users  
        WHERE  id = 1`;
      
      const normalized = SqlSnapshotMatcher.normalize(sql);
      
      expect(normalized).toBe('SELECT * FROM users WHERE id = 1');
    });

    it('should preserve whitespace when option is false', () => {
      const sql = 'SELECT  *  FROM   users';
      
      const normalized = SqlSnapshotMatcher.normalize(sql, {
        normalizeWhitespace: false
      });
      
      expect(normalized).toBe(sql);
    });

    it('should trim leading and trailing whitespace', () => {
      const sql = '   SELECT * FROM users   ';
      
      const normalized = SqlSnapshotMatcher.normalize(sql);
      
      expect(normalized).toBe('SELECT * FROM users');
    });

    it('should ignore parameter values when option is true', () => {
      const sql1 = 'SELECT * FROM users WHERE id = $1 AND age = $2';
      const sql2 = 'SELECT * FROM users WHERE id = $5 AND age = $10';
      
      const normalized1 = SqlSnapshotMatcher.normalize(sql1, {
        ignoreParameterValues: true
      });
      const normalized2 = SqlSnapshotMatcher.normalize(sql2, {
        ignoreParameterValues: true
      });
      
      expect(normalized1).toBe(normalized2);
      expect(normalized1).toBe('SELECT * FROM users WHERE id = $? AND age = $?');
    });

    it('should handle question mark parameters', () => {
      const sql = 'SELECT * FROM users WHERE id = ? AND name = ?';
      
      const normalized = SqlSnapshotMatcher.normalize(sql, {
        ignoreParameterValues: true
      });
      
      expect(normalized).toBe('SELECT * FROM users WHERE id = ? AND name = ?');
    });

    it('should handle named parameters', () => {
      const sql = 'SELECT * FROM users WHERE id = @id AND name = @name';
      
      const normalized = SqlSnapshotMatcher.normalize(sql, {
        ignoreParameterValues: true
      });
      
      expect(normalized).toBe('SELECT * FROM users WHERE id = @? AND name = @?');
    });

    it('should combine multiple normalization options', () => {
      const sql = `SELECT  *  FROM   users  
        WHERE  id = $1   AND  age = $2`;
      
      const normalized = SqlSnapshotMatcher.normalize(sql, {
        normalizeWhitespace: true,
        ignoreParameterValues: true
      });
      
      expect(normalized).toBe('SELECT * FROM users WHERE id = $? AND age = $?');
    });
  });

  describe('toMatchSqlSnapshot()', () => {
    it('should pass when SQL matches', () => {
      const received = 'SELECT * FROM users';
      const expected = 'SELECT * FROM users';
      
      const result = SqlSnapshotMatcher.toMatchSqlSnapshot(received, expected);
      
      expect(result.pass).toBe(true);
    });

    it('should fail when SQL does not match', () => {
      const received = 'SELECT * FROM users';
      const expected = 'SELECT * FROM posts';
      
      const result = SqlSnapshotMatcher.toMatchSqlSnapshot(received, expected);
      
      expect(result.pass).toBe(false);
    });

    it('should normalize both received and expected', () => {
      const received = `SELECT  *  
        FROM   users`;
      const expected = 'SELECT * FROM users';
      
      const result = SqlSnapshotMatcher.toMatchSqlSnapshot(received, expected);
      
      expect(result.pass).toBe(true);
    });

    it('should return error message when not matching', () => {
      const received = 'SELECT * FROM users';
      const expected = 'SELECT * FROM posts';
      
      const result = SqlSnapshotMatcher.toMatchSqlSnapshot(received, expected);
      
      expect(result.message()).toContain('Expected SQL to match snapshot');
      expect(result.message()).toContain('SELECT * FROM users');
      expect(result.message()).toContain('SELECT * FROM posts');
    });

    it('should return success message when matching', () => {
      const received = 'SELECT * FROM users';
      const expected = 'SELECT * FROM users';
      
      const result = SqlSnapshotMatcher.toMatchSqlSnapshot(received, expected);
      
      expect(result.message()).toBe('Expected SQL not to match snapshot');
    });

    it('should apply normalization options', () => {
      const received = 'SELECT * FROM users WHERE id = $1';
      const expected = 'SELECT * FROM users WHERE id = $5';
      
      const result = SqlSnapshotMatcher.toMatchSqlSnapshot(received, expected, {
        ignoreParameterValues: true
      });
      
      expect(result.pass).toBe(true);
    });

    it('should handle undefined expected', () => {
      const received = 'SELECT * FROM users';
      
      const result = SqlSnapshotMatcher.toMatchSqlSnapshot(received);
      
      expect(result.pass).toBe(false);
    });
  });

  describe('setupSqlSnapshotMatchers()', () => {
    it('should extend Jest expect', () => {
      setupSqlSnapshotMatchers();
      
      expect(expect('SELECT * FROM users').toMatchSqlSnapshot).toBeDefined();
    });

    it('should work with Jest matcher', () => {
      setupSqlSnapshotMatchers();
      
      const sql1 = 'SELECT  *  FROM   users';
      const sql2 = 'SELECT * FROM users';
      
      expect(sql1).toMatchSqlSnapshot(sql2);
    });

    it('should support normalization options in Jest matcher', () => {
      setupSqlSnapshotMatchers();
      
      const sql1 = 'SELECT * FROM users WHERE id = $1';
      const sql2 = 'SELECT * FROM users WHERE id = $5';
      
      expect(sql1).toMatchSqlSnapshot(sql2, {
        ignoreParameterValues: true
      });
    });
  });
});
