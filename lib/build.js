var util = require('util');
var fs = require('fs');
var path = require('path');
var conf = require('./config');
var webpack = require('webpack');
var merge = require('webpack-merge');
const findUp = require('find-up');

const readdir = util.promisify(fs.readdir);
/*
 * Possible babel files were taken from
 * https://github.com/babel/babel/blob/master/packages/babel-core/src/config/files/configuration.js#L24
 */

const BABEL_ROOT_CONFIG_FILENAMES = [
  'babel.config.js',
  'babel.config.cjs',
  'babel.config.mjs',
  'babel.config.json',
];

const BABEL_RELATIVE_CONFIG_FILENAMES = [
  '.babelrc',
  '.babelrc.js',
  '.babelrc.cjs',
  '.babelrc.mjs',
  '.babelrc.json',
];

const BABEL_CONFIG_FILENAMES = [
  ...BABEL_ROOT_CONFIG_FILENAMES,
  ...BABEL_RELATIVE_CONFIG_FILENAMES,
];

const testFilePattern = '\\.(test|spec)\\.?';

// custom babel target for each node version
function getBabelTarget(envConfig) {
  var key = 'AWS_LAMBDA_JS_RUNTIME';
  var runtimes = ['nodejs8.15.0', 'nodejs6.10.3'];
  var current = envConfig[key] || process.env[key] || 'nodejs8.15.0';
  var unknown = runtimes.indexOf(current) === -1;
  return unknown ? '8.15.0' : current.replace(/^nodejs/, '');
}

async function getRepositoryRoot(functionsDir, cwd) {
  const gitDirectory = await findUp('.git', {
    cwd: functionsDir,
    type: 'directory',
  });
  if (gitDirectory === undefined) {
    return cwd;
  }

  return path.dirname(gitDirectory);
}

async function existsBabelConfig(functionsDir, cwd) {
  const repositoryRoot = await getRepositoryRoot(functionsDir, cwd);
  const babelConfigFile = await findUp(
    (dir) => {
      const babelConfigFile = BABEL_CONFIG_FILENAMES.find(
        (babelConfigFilename) =>
          findUp.sync.exists(path.join(dir, babelConfigFilename)),
      );
      if (babelConfigFile) {
        return path.join(dir, babelConfigFile);
      }
      // Don't search higher than the repository root
      if (dir === repositoryRoot) {
        return findUp.stop;
      }
      return undefined;
    },
    {
      cwd: functionsDir,
    },
  );
  return Boolean(babelConfigFile);
}

async function webpackConfig(
  dir,
  { userWebpackConfig, useBabelrc, cwd = process.cwd() } = {},
) {
  var config = await conf.load();
  var envConfig = conf.loadContext(config).environment;
  var babelOpts = { cacheDirectory: true };

  var dirPath = path.resolve(path.join(cwd, dir));
  const isBabelConfigExists = await existsBabelConfig(dirPath, cwd);
  if (!isBabelConfigExists) {
    babelOpts.presets = [
      [
        require.resolve('@babel/preset-env'),
        { targets: { node: getBabelTarget(envConfig) } },
      ],
    ];

    babelOpts.plugins = [
      require.resolve('@babel/plugin-proposal-class-properties'),
      require.resolve('@babel/plugin-transform-object-assign'),
      require.resolve('@babel/plugin-proposal-object-rest-spread'),
    ];
  }

  var functionsDir = config.build.functions || config.build.Functions;
  var functionsPath = path.resolve(path.join(cwd, functionsDir));

  if (dirPath === functionsPath) {
    throw new Error(
      `
      netlify-lambda Error: Function source folder (specified in netlify-lambda serve/build command) and publish folder (specified in netlify.toml)
      should be different. They are both set to ${dirPath}.

      This is a common mistake for people switching from Netlify Dev to netlify-lambda. For an easy fix, change your functions key inside netlify.toml to something else, like "functions-build".
      You will then need to build your functions to that directory before they will work locally and the built functions will also need to be pushed to your repo.
      For more info, check https://github.com/netlify/netlify-lambda#usage
      `,
    );
  }

  // Include environment variables from config if available
  var defineEnv = {};
  Object.keys(envConfig).forEach((key) => {
    defineEnv['process.env.' + key] = JSON.stringify(envConfig[key]);
  });

  // Keep the same NODE_ENV if it was specified
  var nodeEnv = process.env.NODE_ENV || 'production';

  // Set webpack mode based on the nodeEnv
  var webpackMode = ['production', 'development'].includes(nodeEnv)
    ? nodeEnv
    : 'none';

  var webpackConfig = {
    mode: webpackMode,
    resolve: {
      extensions: ['.wasm', '.mjs', '.js', '.json', '.ts'],
      mainFields: ['module', 'main'],
    },
    module: {
      rules: [
        {
          test: /\.(m?js|ts)?$/,
          exclude: new RegExp(
            `(node_modules|bower_components|${testFilePattern})`,
          ),
          use: {
            loader: require.resolve('babel-loader'),
            options: { ...babelOpts, babelrc: useBabelrc },
          },
        },
      ],
    },
    context: dirPath,
    entry: {},
    target: 'node',
    plugins: [
      new webpack.IgnorePlugin(/vertx/),
      new webpack.DefinePlugin(defineEnv),
    ],
    output: {
      path: functionsPath,
      filename: '[name].js',
      libraryTarget: 'commonjs',
    },
    optimization: {
      nodeEnv,
    },
    bail: true,
    devtool: false,
    stats: {
      colors: true,
    },
  };
  const files = await readdir(dirPath);
  files.forEach(function (file) {
    if (file.match(/\.(m?js|ts)$/)) {
      var name = file.replace(/\.(m?js|ts)$/, '');
      if (!name.match(new RegExp(testFilePattern))) {
        webpackConfig.entry[name] = './' + file;
      }
    }
  });
  if (Object.keys(webpackConfig.entry) < 1) {
    console.warn(
      `
      ---Start netlify-lambda notification---
      WARNING: No valid single functions files (ending in .mjs, .js or .ts) were found. 
      This could be because you have nested them in a folder.
      If this is expected (e.g. you have a zipped function built somewhere else), you may ignore this.
      ---End netlify-lambda notification---
      `,
    );
  }
  if (userWebpackConfig) {
    var webpackAdditional = require(path.join(cwd, userWebpackConfig));

    return merge.smart(webpackConfig, webpackAdditional);
  }

  return webpackConfig;
}

exports.run = async function (dir, additionalConfig) {
  const config = await webpackConfig(dir, additionalConfig);
  return new Promise(function (resolve, reject) {
    webpack(config, function (err, stats) {
      if (err) {
        return reject(err);
      }
      const errors = stats.compilation.errors || [];
      if (errors.length > 0) {
        return reject(stats.compilation.errors);
      }
      resolve(stats);
    });
  });
};

exports.watch = async function (dir, additionalConfig, cb) {
  const compiler = webpack(await webpackConfig(dir, additionalConfig));
  compiler.watch(await webpackConfig(dir, additionalConfig), cb);
};
