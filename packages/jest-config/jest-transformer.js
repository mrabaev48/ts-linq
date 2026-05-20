// ts-jest astTransformer adapter for @ts-linq/transformer.
// Registered via astTransformers.before in tsLinqTsJestConfig so that
// .where(lambda) calls are rewritten at compile time in all jest test suites.

const mod = require('../transformer/dist/index.js');
const tsLinqTransformer = mod.default || mod;

function getProgram(tsCompiler) {
  if (
    tsCompiler &&
    tsCompiler._languageService &&
    typeof tsCompiler._languageService.getProgram === 'function'
  ) {
    return tsCompiler._languageService.getProgram();
  }
  return tsCompiler && tsCompiler.program ? tsCompiler.program : tsCompiler;
}

function factory(tsCompiler, options) {
  return (ctx) => {
    const program = getProgram(tsCompiler);
    const innerTransformer = tsLinqTransformer(program, options);
    const innerFn = innerTransformer(ctx);
    return (sourceFile) => innerFn(sourceFile);
  };
}

module.exports = {
  version: 1,
  name: 'ts-linq-transformer',
  factory
};
