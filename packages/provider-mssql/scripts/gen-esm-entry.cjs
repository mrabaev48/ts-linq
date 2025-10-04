const { writeFileSync } = require('fs');
writeFileSync(
  'dist/index.esm.js',
  "export * from './esm/index.js';\n",
  'utf8'
);


