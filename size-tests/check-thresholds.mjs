import fs from 'node:fs';
import zlib from 'node:zlib';

const files = [
  { path: 'size-tests/dist/min-bundle.js', maxGzip: 14 * 1024 },
  { path: 'size-tests/dist/wide-bundle.js', maxGzip: 25 * 1024 }
];

function sizeGzip(p) {
  const buf = fs.readFileSync(p);
  const gz = zlib.gzipSync(buf);
  return gz.length;
}

let ok = true;
for (const f of files) {
  const gz = sizeGzip(f.path);
  if (gz > f.maxGzip) {
    console.error(`Size threshold exceeded for ${f.path}: gzip=${gz} > ${f.maxGzip}`);
    ok = false;
  } else {
    console.log(`OK ${f.path}: gzip=${gz} <= ${f.maxGzip}`);
  }
}

process.exit(ok ? 0 : 1);
