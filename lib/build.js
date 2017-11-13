var fs = require("fs");
var path = require("path");
var conf = require("./config");
var webpack = require("webpack");

function webpackConfig(dir) {
  var config = conf.load();
  var webpackConfig = {
    module: {
      rules: [
        {
          test: /\.js?$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: "babel-loader",
            options: {
              cacheDirectory: true,
              presets: ["es2015"],
              plugins: [
                "transform-class-properties",
                "transform-object-assign",
                "transform-object-rest-spread"
              ]
            }
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
  return webpackConfig;
}

exports.run = function(dir) {
  return new Promise(function(resolve, reject) {
    webpack(webpackConfig(dir), function(err, stats) {
      if (err) {
        return reject(err);
      }
      resolve(stats);
    });
  });
};

exports.watch = function(dir, cb) {
  var compiler = webpack(webpackConfig(dir));
  compiler.watch(webpackConfig(dir), cb);
};
