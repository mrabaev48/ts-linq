const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const esmIndex = path.join(distDir, 'esm', 'index.js');
const outFile = path.join(distDir, 'index.esm.js');

if (!fs.existsSync(esmIndex)) {
  console.error(`Missing ${esmIndex}. Did you run ESM build?`);
  process.exit(1);
}

const content = "export * from './esm/index.js';\nexport { default } from './esm/index.js';\n";
fs.writeFileSync(outFile, content);
console.log(`Generated ${path.relative(process.cwd(), outFile)}`);
