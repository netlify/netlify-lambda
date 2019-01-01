var toml = require("toml");
var fs = require("fs");
var path = require("path");
var findUp = require('find-up');
var path = require('path');

exports.load = function() {
  var configPath = findUp.sync("netlify.toml");
  if (!fs.existsSync(configPath)) {
    console.error(
      "No netlify.toml found. This is needed to configure the function settings"
    );
    process.exit(1);
  }

  return {
    config: toml.parse(fs.readFileSync(configPath)),
    rootPath: path.join(configPath, '..'),
  };
};
