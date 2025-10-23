module.exports = {
  PostgresProvider: class {
    constructor(url, logger, mw, sd, rp, pool, health) {
      global.__constructed = { url, pool, health };
    }
  }
};
