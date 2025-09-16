import fs from 'node:fs';
import zlib from 'node:zlib';

const files = [
  'size-tests/dist/min-bundle.js',
  'size-tests/dist/wide-bundle.js'
];

function pretty(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(2)} MB`;
}

for (const f of files) {
  const buf = fs.readFileSync(f);
  const gz = zlib.gzipSync(buf);
  console.log(`${f}: raw=${pretty(buf.length)}, gzip=${pretty(gz.length)}`);
}
