const util = require('util');
const fs = require('fs');
const path = require('path');
const rimraf = util.promisify(require('rimraf'));
const tempy = require('tempy');
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

const mkdir = util.promisify(fs.mkdir);
const pWriteFile = util.promisify(fs.writeFile);

const writeFile = async (fullPath, content) => {
  await mkdir(path.dirname(fullPath), { recursive: true });
  await pWriteFile(fullPath, content);
};

const writeFileInBuild = async (content, file) => {
  const fullPath = `${buildTemp}/${file}`;
  await writeFile(fullPath, content);
  return fullPath;
};

const writeFileInFunctions = async (content, file) => {
  const fullPath = path.join(functions, file);
  await writeFile(fullPath, content);
  return fullPath;
};

const findBabelLoaderRule = (rules) =>
  rules.find((rule) => rule.use.loader.includes('babel-loader'));

const validateNotDetectedBabelConfig = (stats) => {
  const babelLoaderRuleOptions = findBabelLoaderRule(
    stats.compilation.options.module.rules,
  ).use.options;

  expect(babelLoaderRuleOptions.presets).toBeDefined();
  expect(babelLoaderRuleOptions.plugins).toBeDefined();
};

const validateDetectedBabelConfig = (stats) => {
  const babelLoaderRuleOptions = findBabelLoaderRule(
    stats.compilation.options.module.rules,
  ).use.options;

  expect(babelLoaderRuleOptions.presets).toBeUndefined();
  expect(babelLoaderRuleOptions.plugins).toBeUndefined();
};

describe('build', () => {
  beforeEach(async () => {
    await mkdir(buildTemp, { recursive: true });
  });

  afterEach(async () => {
    await rimraf(buildTemp);
  });

  describe('run', () => {
    it('should return webpack stats on successful build', async () => {
      const functionsBuildOutputDir = (await require('./config').load()).build
        .functions;

      const script = `module.exports = () => console.log("hello world")`;
      await writeFileInFunctions(script, 'index.js');

      const stats = await build.run(functions);
      expect(stats.compilation.errors).toHaveLength(0);
      expect(
        fs.existsSync(path.join(functionsBuildOutputDir, 'index.js')),
      ).toEqual(true);
    });

    it('should throw error on complication errors', async () => {
      const script = `module.exports = () => console.log("hello`;
      await writeFileInFunctions(script, 'index.js');

      expect.assertions(1);

      await expect(build.run(functions)).rejects.toHaveLength(1);
    });

    it('should throw error on invalid config', async () => {
      const script = `module.exports = () => console.log("hello world")`;
      await writeFileInFunctions(script, 'index.js');

      expect.assertions(1);

      await expect(
        build.run(functions, {
          userWebpackConfig: 'non-existing-webpack-config.js',
        }),
      ).rejects.toThrow('Cannot find module');
    });

    it('should merge webpack custom config', async () => {
      const script = `module.exports = () => console.log("hello world")`;
      await writeFileInFunctions(script, 'index.js');

      const webpackConfig = `module.exports = { resolve: { extensions: ['.custom'] } }`;
      const userWebpackConfig = await writeFileInBuild(
        webpackConfig,
        'webpack/webpack.js',
      );

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

    describe('babel config file resolution', () => {
      it('should alter the default babelOpts when no valid babel config file is found', async () => {
        await writeFileInFunctions('', 'not-babel.config.js');

        const stats = await build.run(functions);

        validateNotDetectedBabelConfig(stats);
      });

      it('should not alter the default babelOpts when a valid babel config file is found in same directory as the functions directory', async () => {
        await writeFileInFunctions('', 'babel.config.js');

        const stats = await build.run(functions);

        validateDetectedBabelConfig(stats);
      });

      it('should not alter the default babelOpts when a valid babel config is found in directory above the functions directory', async () => {
        const [, fullPath] = await Promise.all([
          writeFileInFunctions('', 'babel.config.js'),
          writeFileInFunctions('', `sub-dir/index.js`),
        ]);

        const stats = await build.run(path.dirname(fullPath));

        validateDetectedBabelConfig(stats);
      });

      it('should not alter the default babelOpts when a valid babel config is found in a monorepo', async () => {
        const stats = await tempy.directory.task(async (directory) => {
          await Promise.all([
            writeFile(`${directory}/.git/HEAD`, ''),
            writeFile(
              `${directory}/packages/netlify-site/functions/index.js`,
              'module.exports = () => console.log("hello world")',
            ),
            writeFile(`${directory}/babel.config.js`, ''),
          ]);

          return await build.run(`packages/netlify-site/functions`, {
            cwd: directory,
          });
        });

        validateDetectedBabelConfig(stats);
      });

      it('should not alter the default babelOpts when a valid babel config is found in a non git project', async () => {
        const stats = await tempy.directory.task(async (directory) => {
          await Promise.all([
            writeFile(
              `${directory}/packages/netlify-site/functions/index.js`,
              'module.exports = () => console.log("hello world")',
            ),
            writeFile(`${directory}/babel.config.js`, ''),
          ]);

          return await build.run(`packages/netlify-site/functions`, {
            cwd: directory,
          });
        });

        validateDetectedBabelConfig(stats);
      });
    });
  });
});
