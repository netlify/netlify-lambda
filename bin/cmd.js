#!/usr/bin/env node

/**
 * Module dependencies.
 */

var program = require('commander');
var fs = require('fs');
var path = require('path');
var pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json')),
);
var build = require('../lib/build');
var serve = require('../lib/serve');
var install = require('../lib/install');

program.version(pkg.version);
program.showHelpAfterError();

const stringBooleanToBoolean = (val) => {
  if (typeof val !== 'string' && (val !== 'true' || val !== 'false')) {
    throw Error(`Incorrect string value: ${val}`);
  }

  return val === 'true';
};

program
  .option('-c --config <webpack-config>', 'additional webpack configuration')
  .option('-p --port <port>', 'port to serve from (default: 9000)')
  .option(
    '-b --babelrc <babelrc>',
    'use .babelrc in root (default: true)',
    stringBooleanToBoolean,
  )
  .option(
    '-t --timeout <timeout>',
    'function invocation timeout in seconds (default: 10)',
  )
  .option('-s --static', 'serve pre-built lambda files');

program
  .command('serve <dir>')
  .description('serve and watch functions')
  .action(function (dir) {
    console.log('netlify-lambda: Starting server');
    var opts = program.opts();
    var static = Boolean(opts.static);
    var server;
    var startServer = async function () {
      server = await serve.listen(
        opts.port || 9000,
        static,
        Number(opts.timeout) || 10,
      );
    };
    if (static) {
      startServer();
      return; // early terminate, don't build
    }
    const { config: userWebpackConfig, babelrc: useBabelrc = true } =
      program.opts();
    build.watch(
      dir,
      { userWebpackConfig, useBabelrc },
      async function (err, stats) {
        if (err) {
          console.error(err);
          return;
        }
        console.log(stats.toString(stats.compilation.options.stats));
        if (!server) {
          await startServer();
        }
        stats.compilation.chunks.forEach(function (chunk) {
          server.clearCache(chunk.name || chunk.id.toString());
        });
      },
    );
  });

program
  .command('build <dir>')
  .description('build functions')
  .action(function (dir) {
    console.log('netlify-lambda: Building functions');

    const { config: userWebpackConfig, babelrc: useBabelrc = true } =
      program.opts();
    build
      .run(dir, { userWebpackConfig, useBabelrc })
      .then(function (stats) {
        console.log(stats.toString(stats.compilation.options.stats));
      })
      .catch(function (err) {
        console.error(err);
        process.exit(1);
      });
  });

program
  .command('install [dir]')
  .description('install functions')
  .action(function (dir) {
    console.log('netlify-lambda: installing function dependencies');
    install.run(dir).catch(function (err) {
      console.error(err);
      process.exit(1);
    });
  });

// error on unknown commands
// ref: https://github.com/tj/commander.js#custom-event-listeners
program.on('command:*', function () {
  console.error(
    'Invalid command: %s\nSee --help for a list of available commands.',
    program.args.join(' '),
  );
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
