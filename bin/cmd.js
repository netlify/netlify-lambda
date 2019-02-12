#!/usr/bin/env node

/**
 * Module dependencies.
 */

var program = require("commander");
var fs = require("fs");
var path = require("path");
var pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"))
);
var build = require("../lib/build");
var serve = require("../lib/serve");

program.version(pkg.version);

program
  .option("-c --config <webpack-config>", "additional webpack configuration")
  .option("-p --port <port>", "port to serve from (default: 9000)")
  .option("-t --timeout <timeout>", "function invocation timeout in seconds (default: 10)")
  .option("-s --static", "serve pre-built lambda files");

program
  .command("serve <dir>")
  .description("serve and watch functions")
  .action(function(cmd, options) {
    console.log("netlify-lambda: Starting server");
    var static = Boolean(program.static);
    var server = serve.listen(program.port || 9000, static, Number(program.timeout) || 10);
    if (static) return; // early terminate, don't build
    build.watch(cmd, program.config, function(err, stats) {
      if (err) {
        console.error(err);
        return;
      }

      stats.compilation.chunks.forEach(function(chunk) {
        server.clearCache(chunk.name);
      });

      console.log(stats.toString({ color: true }));
    });
  });

program
  .command("build <dir>")
  .description("build functions")
  .action(function(cmd, options) {
    console.log("netlify-lambda: Building functions");
    build
      .run(cmd, program.config)
      .then(function(stats) {
        console.log(stats.toString({ color: true }));
      })
      .catch(function(err) {
        console.error(err);
        process.exit(1);
      });
  });

// error on unknown commands
// ref: https://github.com/tj/commander.js#custom-event-listeners
program
  .on('command:*', function () {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
    process.exit(1);
  });

program.parse(process.argv);

// check if no command line args are provided
// ref: https://github.com/tj/commander.js/issues/7#issuecomment-32448653
var NO_COMMAND_SPECIFIED = program.args.length === 0;

if (NO_COMMAND_SPECIFIED) {
  // user did not supply args, so show --help
  program.help();
}
