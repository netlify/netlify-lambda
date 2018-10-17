## Netlify Lambda CLI

This is a small CLI tool that helps with building or serving lambdas built with a simple webpack/babel setup.

The goal is to make it easy to work with Lambda's with modern ES6 without being dependent on having the most state of the art node runtime available in the final deployment environment and with a build that can compile all modules into a single lambda file.

Since v1.0.0 the dependencies were upgraded to Webpack 4 and Babel 7.

## Installation

**We recommend installing locally** rather than globally: `yarn add -D netlify-lambda`. This will ensure your build scripts don't assume a global install which is better for your CI/CD (for example with Netlify's buildbot).

## Usage

Netlify lambda installs two commands:

```
netlify-lambda serve <folder>
netlify-lambda build <folder>
```

**IMPORTANT**: Both commands depend on a `netlify.toml` file being present in your project and configuring functions for deployment.

The `serve` function will start a dev server and a file watcher for the specified folder and route requests to the relevant function at:

```
http://localhost:9000/hello -> folder/hello.js (must export a handler(event, context callback) function)
```

The `build` function will run a single build of the functions in the folder.

There are additional options, introduced later:
```bash
-h --help
-c --config
-p --port
-s --static
```

### Proxying for local development

When your function is deployed on Netlify, it will be available at `/.netlify/functions/function-name` for any given deploy context. It is advantageous to proxy the `netlify-lambda serve` development server to the same path on your primary development server.

Say you are running `webpack-serve` on port 8080 and `netlify-lambda serve` on port 9000. Mounting `localhost:9000` to `/.netlify/functions/` on your `webpack-serve` server (`localhost:8080/.netlify/functions/`) will closely replicate what the final production environment will look like during development, and will allow you to assume the same function url path in development and in production.

See [netlify/create-react-app-lambda](https://github.com/netlify/create-react-app-lambda/blob/3b5fac5fcbcba0e775b755311d29242f0fc1d68e/package.json#L19) for an example of how to do this.

[Example webpack config](https://github.com/imorente/netlify-functions-example/blob/master/webpack.development.config):

```js
module.exports = {
  mode: "development",
  devServer: {
    proxy: {
      "/.netlify": {
        target: "http://localhost:9000",
        pathRewrite: { "^/.netlify/functions": "" }
      }
    }
  }
};
```

The serving port can be changed with the `-p`/`--port` option.

## Webpack Configuration

By default the webpack configuration uses `babel-loader` to load all js files. Any `.babelrc` in the directory `netlify-lambda` is run from will be respected. If no `.babelrc` is found, a [few basic settings are used](https://github.com/netlify/netlify-lambda/blob/master/lib/build.js#L11-L15a).

If you need to use additional webpack modules or loaders, you can specify an additional webpack config with the `-c`/`--config` option when running either `serve` or `build`. See this issue for an example of [how to write a webpack override file](https://github.com/netlify/netlify-lambda/issues/64).

The additional webpack config will be merged into the default config via [webpack-merge's](https://www.npmjs.com/package/webpack-merge) `merge.smart` method.

### babel configuration

The default webpack configuration uses `babel-loader` with a [few basic settings](https://github.com/netlify/netlify-lambda/blob/master/lib/build.js#L19-L33).

However, if any `.babelrc` is found in the directory `netlify-lambda` is run from, it will be used instead of the default one. If you need to run different babel versions for your lambda and for your app, [check this issue](https://github.com/netlify/netlify-lambda/issues/34) to override your webpack babel-loader.

### --static option

If you need an escape hatch and are building your lambda in some way that is incompatible with our build process, you can skip the build with the `-s` or `--static` flag. [More info here](https://github.com/netlify/netlify-lambda/pull/62).

## Other community approaches

If you wish to serve the full website from lambda, [check this issue](https://github.com/netlify/netlify-lambda/issues/36).

If you wish to run this server for testing, [check this issue](https://github.com/netlify/netlify-lambda/issues/49).

If you wish to emulate more Netlify functionality locally, [check this repo](https://github.com/8eecf0d2/netlify-local)

All of the above are community maintained and not officially supported by Netlify.

## License

[MIT](LICENSE)
