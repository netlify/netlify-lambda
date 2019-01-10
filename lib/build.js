var fs = require("fs");
var path = require("path");
var conf = require("./config");
var webpack = require("webpack");
var merge = require("webpack-merge");

// custom babel target for each node version
function getBabelTarget(envConfig) {
  var key = "AWS_LAMBDA_JS_RUNTIME";
  var runtimes = ["nodejs8.10", "nodejs4.3.2", "nodejs6.10.3"];
  var current = envConfig[key] || process.env[key] || "nodejs6.10.3";
  var unknown = runtimes.indexOf(current) === -1;
  return unknown ? "6.10" : current.replace(/^nodejs/, "");
}


function loadEnvironment(config) {
  var envConfig = config.build.environment || config.build.Environment || {};
  var contextConfig = (
    process.env.CONTEXT &&
    config.context &&
    config.context[process.env.CONTEXT] &&
    (config.context[process.env.CONTEXT].environment || config.context[process.env.CONTEXT].Environment)
  ) || {};
  var branchConfig = (
    process.env.BRANCH &&
    config.context &&
    config.context[process.env.BRANCH] &&
    (config.context[process.env.BRANCH].environment || config.context[process.env.BRANCH].Environment)
  ) || {};
  return merge(envConfig, contextConfig, branchConfig);
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

function webpackConfig(dir, additionalConfig) {
  var config = conf.load();
  var envConfig = loadEnvironment(config);
  var babelOpts = { cacheDirectory: true };
  if (!haveBabelrc(dir)) {
    babelOpts.presets = [
      ["@babel/preset-env", { targets: { node: getBabelTarget(envConfig) } }]
    ];

    babelOpts.plugins = [
      "@babel/plugin-proposal-class-properties",
      "@babel/plugin-transform-object-assign",
      "@babel/plugin-proposal-object-rest-spread"
    ];
  }

  var functionsDir = config.build.functions || config.build.Functions;
  var functionsPath = path.join(process.cwd(), functionsDir);
  var dirPath = path.join(process.cwd(), dir);

  if (dirPath === functionsPath) {
    throw new Error(
      "Function source and publish folder should be in different locations"
    );
  }

  // Include environment variables from config if available
  var defineEnv = {};
  Object.keys(envConfig).forEach(key => {
    defineEnv["process.env." + key] = JSON.stringify(envConfig[key]);
  });

  var webpackConfig = {
    mode: "production",
    resolve: {
      extensions: [".wasm", ".mjs", ".js", ".json", ".ts"]
    },
    module: {
      rules: [
        {
          test: /\.(m?js|ts)?$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: "babel-loader",
            options: babelOpts
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
    devtool: false
  };
  fs.readdirSync(dirPath).forEach(function(file) {
    if (file.match(/\.(m?js|ts)$/)) {
      var name = file.replace(/\.(m?js|ts)$/, "");
      webpackConfig.entry[name] = "./" + file;
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
  if (additionalConfig) {
    var webpackAdditional = require(path.join(process.cwd(), additionalConfig));

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
