var fs = require("fs");
var path = require("path");
var conf = require("./config");
var webpack = require("webpack");
var merge = require("webpack-merge");

const testFilePattern = "\\.(test|spec)\\.?";

// custom babel target for each node version
function getBabelTarget(envConfig) {
  var key = "AWS_LAMBDA_JS_RUNTIME";
  var runtimes = ["nodejs8.15.0", "nodejs6.10.3"];
  var current = envConfig[key] || process.env[key] || "nodejs8.15.0";
  var unknown = runtimes.indexOf(current) === -1;
  return unknown ? "8.15.0" : current.replace(/^nodejs/, "");
}

function haveBabelrc(functionsDir) {
  const cwd = process.cwd();

  return (
    fs.existsSync(path.join(cwd, ".babelrc")) ||
    functionsDir.split("/").reduce((foundBabelrc, dir) => {
      if (foundBabelrc) return foundBabelrc;

      const indexOf = functionsDir.indexOf(dir);
      const dirToSearch = functionsDir.substr(0, indexOf);

      return fs.existsSync(path.join(cwd, dirToSearch, ".babelrc"));
    }, false)
  );
}

function webpackConfig(dir, { userWebpackConfig, useBabelrc } = {}) {
  var config = conf.load();
  var envConfig = conf.loadContext(config).environment;
  var babelOpts = { cacheDirectory: true };
  if (!haveBabelrc(dir)) {
    babelOpts.presets = [
      [
        require.resolve("@babel/preset-env"),
        { targets: { node: getBabelTarget(envConfig) } }
      ]
    ];

    babelOpts.plugins = [
      require.resolve("@babel/plugin-proposal-class-properties"),
      require.resolve("@babel/plugin-transform-object-assign"),
      require.resolve("@babel/plugin-proposal-object-rest-spread")
    ];
  }

  var functionsDir = config.build.functions || config.build.Functions;
  var functionsPath = path.resolve(path.join(process.cwd(), functionsDir));
  var dirPath = path.resolve(path.join(process.cwd(), dir));

  if (dirPath === functionsPath) {
    throw new Error(
      `
      netlify-lambda Error: Function source folder (specified in netlify-lambda serve/build command) and publish folder (specified in netlify.toml)
      should be different. They are both set to ${dirPath}.

      This is a common mistake for people switching from Netlify Dev to netlify-lambda. For an easy fix, change your functions key inside netlify.toml to something else, like "functions-build".
      For more info, check https://github.com/netlify/netlify-lambda#usage
      `
    );
  }

  // Include environment variables from config if available
  var defineEnv = {};
  Object.keys(envConfig).forEach(key => {
    defineEnv["process.env." + key] = JSON.stringify(envConfig[key]);
  });

  // Keep the same NODE_ENV if it was specified
  var nodeEnv = process.env.NODE_ENV || "production";

  // Set webpack mode based on the nodeEnv
  var webpackMode = ["production", "development"].includes(nodeEnv)
    ? nodeEnv
    : "none";

  var webpackConfig = {
    mode: webpackMode,
    resolve: {
      extensions: [".wasm", ".mjs", ".js", ".json", ".ts"],
      mainFields: ["module", "main"]
    },
    module: {
      rules: [
        {
          test: /\.(m?js|ts)?$/,
          exclude: new RegExp(
            `(node_modules|bower_components|${testFilePattern})`
          ),
          use: {
            loader: require.resolve("babel-loader"),
            options: { ...babelOpts, babelrc: useBabelrc }
          }
        }
      ]
    },
    context: dirPath,
    entry: {},
    target: "node",
    plugins: [
      new webpack.IgnorePlugin(/vertx/),
      new webpack.DefinePlugin(defineEnv)
    ],
    output: {
      path: functionsPath,
      filename: "[name].js",
      libraryTarget: "commonjs"
    },
    optimization: {
      nodeEnv
    },
    bail: true,
    devtool: false
  };
  fs.readdirSync(dirPath).forEach(function(file) {
    if (file.match(/\.(m?js|ts)$/)) {
      var name = file.replace(/\.(m?js|ts)$/, "");
      if (!name.match(new RegExp(testFilePattern))) {
        webpackConfig.entry[name] = "./" + file;
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
      `
    );
  }
  if (userWebpackConfig) {
    var webpackAdditional = require(path.join(
      process.cwd(),
      userWebpackConfig
    ));

    return merge.smart(webpackConfig, webpackAdditional);
  }

  return webpackConfig;
}

exports.run = function(dir, additionalConfig) {
  return new Promise(function(resolve, reject) {
    webpack(webpackConfig(dir, additionalConfig), function(err, stats) {
      if (err) {
        return reject(err);
      }
      resolve(stats);
    });
  });
};

exports.watch = function(dir, additionalConfig, cb) {
  var compiler = webpack(webpackConfig(dir, additionalConfig));
  compiler.watch(webpackConfig(dir, additionalConfig), cb);
};
