import path from 'node:path';
import { terser } from 'rollup-plugin-terser';
import resolve from '@rollup/plugin-node-resolve';

const inputMin = 'size-tests/min-entry.js';
const inputWide = 'size-tests/wide-entry.js';

/** @type {import('rollup').RollupOptions[]} */
export default [
  // Minimal import entry (typical consumer)
  {
    input: inputMin,
    output: {
      file: 'size-tests/dist/min-bundle.js',
      format: 'esm',
      sourcemap: false
    },
    plugins: [resolve({ extensions: ['.js'] }), terser()],
    external: ['reflect-metadata'],
    onwarn(w, warn) {
      if (w.code === 'THIS_IS_UNDEFINED') return;
      warn(w);
    }
  },
  // Wide import entry (stress import)
  {
    input: inputWide,
    output: {
      file: 'size-tests/dist/wide-bundle.js',
      format: 'esm',
      sourcemap: false
    },
    plugins: [resolve({ extensions: ['.js'] }), terser()],
    external: ['reflect-metadata'],
    onwarn(w, warn) {
      if (w.code === 'THIS_IS_UNDEFINED') return;
      warn(w);
    }
  }
];
