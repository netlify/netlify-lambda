var toml = require('toml');
var fs = require('fs');
var path = require('path');

exports.load = function() {
  var configPath = path.join(process.cwd(), 'netlify.toml');
  if (!fs.existsSync(configPath)) {
    console.error(
      'No netlify.toml found. This is needed to configure the function settings. For more info: https://github.com/netlify/netlify-lambda#installation'
    );
    process.exit(1);
  }

  return toml.parse(fs.readFileSync(configPath));
};

exports.loadContext = function(config) {
  var buildConfig = config.build;
  var contextConfig =
    (process.env.CONTEXT &&
      config.context &&
      config.context[process.env.CONTEXT]) ||
    {};
  var branchConfig =
    (process.env.BRANCH &&
      config.context &&
      config.context[process.env.BRANCH]) ||
    {};
  var buildEnv = buildConfig.environment || buildConfig.Environment || {};
  var contextEnv = contextConfig.environment || contextConfig.Environment || {};
  var branchEnv = branchConfig.environment || branchConfig.Environment || {};
  return {
    ...buildConfig,
    ...contextConfig,
    ...branchConfig,
    environment: {
      ...buildEnv,
      ...contextEnv,
      ...branchEnv
    }
  };
};
