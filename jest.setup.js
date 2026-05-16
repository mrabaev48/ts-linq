// Skip database-dependent e2e tests unless SKIP_DB_TESTS is explicitly set to '0'
if (process.env.SKIP_DB_TESTS === undefined) {
  process.env.SKIP_DB_TESTS = '1';
}
