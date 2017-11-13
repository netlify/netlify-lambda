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
  .command("serve <dir>")
  .description("serve and watch functions")
  .action(function(cmd, options) {
    console.log("Starting server");
    var server = serve.listen(9000);
    build.watch(cmd, function(err, stats) {
      if (err) {
        console.error(err);
        return;
      }

      console.log(stats.compilation);
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
    console.log("Building functions");
    build
      .run(cmd)
      .then(function(stats) {
        console.log(stats.toString({ color: true }));
      })
      .catch(function(err) {
        console.error(err);
        process.exit(1);
      });
  });

console.log("hmm", process.argv);
program.parse(process.argv);
