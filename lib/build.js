var fs = require("fs");
var path = require("path");
var conf = require("./config");
var webpack = require("webpack");
var merge = require("webpack-merge");

function webpackConfig(dir, additionalConfig) {
  var config = conf.load();
  var babelOpts = {cacheDirectory: true};
  if (!fs.existsSync(path.join(process.cwd(), '.babelrc'))) {
    babelOpts.presets = [
      ["env", {
        targets: {
          node: "6.10"
        }
      }]
    ];
    babelOptsplugins = [
      "transform-class-properties",
      "transform-object-assign",
      "transform-object-rest-spread"
    ];
  }

  var webpackConfig = {
    module: {
      rules: [
        {
          test: /\.js?$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: "babel-loader",
            options: babelOpts
          }
        }
      ]
    },
    context: path.join(process.cwd(), dir),
    entry: {},
    target: "node",
    plugins: [new webpack.IgnorePlugin(/vertx/)],
    output: {
      path: path.join(
        process.cwd(),
        config.build.functions || config.build.Functions
      ),
      filename: "[name].js",
      libraryTarget: "commonjs"
    },
    devtool: false
  };
  fs.readdirSync(path.join(process.cwd(), dir)).forEach(function(file) {
    if (file.match(/\.js$/)) {
      var name = file.replace(/\.js$/, "");
      webpackConfig.entry[name] = "./" + name;
    }
  });
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
