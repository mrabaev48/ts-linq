#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function cleanDtsFiles(dir) {
  if (!fs.existsSync(dir)) return;
  
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory() && item.name !== 'esm') {
      cleanDtsFiles(fullPath);
    } else if (item.name.endsWith('.d.ts') || item.name.endsWith('.d.ts.map')) {
      fs.unlinkSync(fullPath);
    }
  }
}

function copyTypesRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    console.log(`Source directory ${srcDir} does not exist, skipping...`);
    return;
  }

  const items = fs.readdirSync(srcDir, { withFileTypes: true });
  
  for (const item of items) {
    const srcPath = path.join(srcDir, item.name);
    const destPath = path.join(destDir, item.name);
    
    if (item.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyTypesRecursive(srcPath, destPath);
    } else if (item.name.endsWith('.d.ts') || item.name.endsWith('.d.ts.map')) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const esmDir = path.join(process.cwd(), 'dist', 'esm');
const distDir = path.join(process.cwd(), 'dist');

console.log(`Cleaning old .d.ts files from ${distDir}`);
cleanDtsFiles(distDir);

console.log(`Copying .d.ts files from ${esmDir} to ${distDir}`);
copyTypesRecursive(esmDir, distDir);
console.log('Done!');
