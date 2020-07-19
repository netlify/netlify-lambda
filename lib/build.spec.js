const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const build = require('./build');

jest.mock('./config', () => {
  const path = require('path');
  return {
    load: jest.fn(() => ({
      build: { functions: path.join('.temp', 'build', 'lambda') },
    })),
    loadContext: jest.fn(() => ({ environment: {} })),
  };
});

const buildTemp = path.join('.temp', 'build');
const functions = path.join(buildTemp, 'functions');

const setupFunction = (script, filename) => {
  fs.mkdirSync(functions, { recursive: true });
  fs.writeFileSync(path.join(functions, filename), script);
};

describe('build', () => {
  const functionsBuildOutputDir = require('./config').load().build.functions;

  beforeEach(() => {
    fs.mkdirSync(buildTemp, { recursive: true });
  });

  afterEach(() => {
    rimraf.sync(buildTemp);
  });

  describe('run', () => {
    it('should return webpack stats on successful build', async () => {
      const script = `module.exports = () => console.log("hello world")`;
      setupFunction(script, 'index.js');

      const stats = await build.run(functions);
      expect(stats.compilation.errors).toHaveLength(0);
      expect(
        fs.existsSync(path.join(functionsBuildOutputDir, 'index.js')),
      ).toEqual(true);
    });

    it('should throw error on complication errors', async () => {
      const script = `module.exports = () => console.log("hello`;
      setupFunction(script, 'index.js');

      expect.assertions(1);

      await expect(build.run(functions)).rejects.toHaveLength(1);
    });

    it('should throw error on invalid config', async () => {
      const script = `module.exports = () => console.log("hello world")`;
      setupFunction(script, 'index.js');

      expect.assertions(1);

      await expect(
        build.run(functions, {
          userWebpackConfig: 'non-existing-webpack-config.js',
        }),
      ).rejects.toThrow('Cannot find module');
    });

    it('should merge webpack custom config', async () => {
      const script = `module.exports = () => console.log("hello world")`;
      setupFunction(script, 'index.js');

      const webpackConfig = `module.exports = { resolve: { extensions: ['.custom'] } }`;
      const customWebpackConfigDir = path.join(buildTemp, 'webpack');
      const userWebpackConfig = path.join(customWebpackConfigDir, 'webpack.js');
      fs.mkdirSync(customWebpackConfigDir, { recursive: true });
      fs.writeFileSync(userWebpackConfig, webpackConfig);

      const stats = await build.run(functions, {
        userWebpackConfig,
      });
      expect(stats.compilation.errors).toHaveLength(0);
      expect(stats.compilation.options.resolve.extensions).toEqual([
        '.wasm',
        '.mjs',
        '.js',
        '.json',
        '.ts',
        '.custom',
      ]);
    });
  });
});
