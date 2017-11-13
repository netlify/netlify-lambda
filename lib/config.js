var toml = require("toml");
var fs = require("fs");
var path = require("path");

exports.load = function() {
  var configPath = path.join(process.cwd(), "netlify.toml");
  if (!fs.existsSync(configPath)) {
    console.error(
      "No netlify.toml found. This is needed to configure the function settings"
    );
    process.exit(1);
  }

  return toml.parse(fs.readFileSync(configPath));
};
