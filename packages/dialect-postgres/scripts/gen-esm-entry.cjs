/* eslint-disable */
const fs = require('fs');
const path = require('path');

const esmIndexPath = path.join(__dirname, '..', 'dist', 'index.esm.js');
const cjsIndexPath = path.join(__dirname, '..', 'dist', 'index.js');

if (fs.existsSync(esmIndexPath) && !fs.existsSync(cjsIndexPath)) {
  fs.copyFileSync(esmIndexPath, cjsIndexPath);
}


