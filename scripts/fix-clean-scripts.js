const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, '../packages');

if (!fs.existsSync(packagesDir)) {
  console.error('Packages directory not found');
  process.exit(1);
}

const packages = fs.readdirSync(packagesDir).filter(f => fs.statSync(path.join(packagesDir, f)).isDirectory());

let updatedCount = 0;

packages.forEach(pkg => {
  const pkgJsonPath = path.join(packagesDir, pkg, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    
    // Standard clean command
    const cleanCommand = "rm -rf dist *.tsbuildinfo";
    
    if (!pkgJson.scripts) {
      pkgJson.scripts = {};
    }

    if (pkgJson.scripts.clean !== cleanCommand) {
      console.log(`Updating clean script for ${pkg}...`);
      pkgJson.scripts.clean = cleanCommand;
      fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
      updatedCount++;
    }
  }
});

console.log(`Updated ${updatedCount} packages.`);
