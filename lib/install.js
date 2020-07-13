const path = require('path');
const globby = require('globby');
const cp = require('child_process');
var conf = require('./config');

function installDeps(functionDir, cb) {
  cp.exec('npm i', { cwd: functionDir }, cb);
}

exports.run = async function (dir) {
  let directory;
  if (dir) {
    var dirPath = path.join(process.cwd(), dir);
    directory = dirPath;
  } else {
    var config = conf.load();
    const functionsDir = config.build.functions || config.build.Functions;
    if (!functionsDir) {
      console.log('Error: no functions dir detected.');
    }
    const functionsPath = path.join(process.cwd(), functionsDir);
    directory = functionsPath;
  }

  const findJSFiles = ['**/package.json', '!node_modules', '!**/node_modules'];
  const foldersWithDeps = await globby(findJSFiles, { cwd: directory });

  foldersWithDeps
    .map((fnFolder) => {
      return fnFolder.substring(0, fnFolder.indexOf('package.json'));
    })
    .map((folder) => {
      installDeps(path.join(directory, folder), () => {
        console.log(`${folder} dependencies installed`);
      });
    });
};
