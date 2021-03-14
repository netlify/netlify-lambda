var toml = require('toml');
var fs = require('fs');
var path = require('path');
var util = require('util');

const readFile = util.promisify(fs.readFile);

exports.load = async function () {
  try {
    const configPath = path.join(process.cwd(), 'netlify.toml');
    const content = await readFile(configPath, 'utf8');
    return toml.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(
        'No netlify.toml found. This is needed to configure the function settings. For more info: https://github.com/netlify/netlify-lambda#installation',
      );
    } else {
      console.error(error);
    }
    process.exit(1);
  }
};

exports.loadContext = function (config) {
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
      ...branchEnv,
    },
  };
};
