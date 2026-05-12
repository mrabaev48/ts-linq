class SimpleSequencer {
  sort(tests) {
    return tests;
  }
  shard(tests, { shardIndex, shardCount }) {
    const sorted = this.sort(tests);
    return sorted.filter((_, i) => i % shardCount === shardIndex);
  }
  cacheResults(tests) {
    return tests;
  }
}

module.exports = SimpleSequencer;


