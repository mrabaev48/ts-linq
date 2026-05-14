module.exports = {
  baseDir: '.',

  includeNpm: false,

  fileExtensions: ['ts', 'tsx'],

  excludeRegExp: [
    '^node_modules/',
    '^dist/',
    '^build/',
    '^coverage/',
    '^reports/',
    '^issues-v3/',
    '\\.test\\.ts$',
    '\\.spec\\.ts$',
    '\\.d\\.ts$'
  ],

  tsConfig: './tsconfig.json'
};
