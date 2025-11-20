describe('MSSQL Provider + QueryBuilder Integration', () => {
  describe('Parameter Naming', () => {
    it.todo('should use @p1, @p2, @p3 for parameters');
    it.todo('should handle named parameters correctly');
  });

  describe('Identifier Escaping', () => {
    it.todo('should use [square brackets] for identifiers');
    it.todo('should escape closing brackets in identifiers');
  });

  describe('IDENTITY Columns', () => {
    it.todo('should insert with IDENTITY and use SCOPE_IDENTITY()');
    it.todo('should handle IDENTITY INSERT ON/OFF');
  });

  describe('TOP vs OFFSET FETCH', () => {
    it.todo('should use TOP for simple limit');
    it.todo('should use OFFSET FETCH for skip + take');
    it.todo('should require ORDER BY with OFFSET FETCH');
  });

  describe('MSSQL-Specific Types', () => {
    it.todo('should handle NVARCHAR for Unicode strings');
    it.todo('should handle uniqueidentifier (GUID)');
    it.todo('should handle XML column type');
  });

  describe('Stored Procedures', () => {
    it.todo('should execute stored procedure via EXEC');
    it.todo('should handle OUTPUT parameters from stored proc');
  });
});


