## Netlify Lambda CLI

This is a small CLI tool that helps with building or serving lambdas built with a simple webpack/babel setup.

The goal is to make it easy to work with Lambda's with modern ES6 without being dependent on having the most state of the art node runtime available in the final deployment environment and with a build that can compile all modules into a single lambda file.

## Installation

We recommend installing locally rather than globally: `yarn add -D netlify-lambda`

At the present moment you may have to also install peer dependencies [as documented here](https://github.com/netlify/netlify-lambda/issues/35) - we will correct this for the next release when we update our [webpack and babel versions](https://github.com/netlify/netlify-lambda/pull/15).

## Usage

Netlify lambda installs two commands:

```
netlify-lambda serve <folder>
netlify-lambda build <folder>
```

Both depends on a `netlify.toml` file being present in your project and configuring functions for deployment.

The `serve` function will start a dev server and a file watcher for the specified folder and route requests to the relevant function at:

```
http://localhost:9000/hello -> folder/hello.js (must export a handler(event, context callback) function)
```

The `build` function will run a single build of the functions in the folder.

### Proxying for local development

When your function is deployed on Netlify, it will be available at `/.netlify/functions/function-name` for any given deploy context.  It is advantageous to proxy the `netlify-lambda serve` development server to the same path on your primary development server.

Say you are running `webpack-serve` on port 8080 and `netlify-lambda serve` on port 9000.  Mounting `localhost:9000` to `/.netlify/functions/` on your `webpack-serve` server (`localhost:8080/.netlify/functions/`) will closely replicate what the final production environment will look like during development, and will allow you to assume the same function url path in development and in production.

See [netlify/create-react-app-lambda](https://github.com/netlify/create-react-app-lambda/blob/3b5fac5fcbcba0e775b755311d29242f0fc1d68e/package.json#L19) for an example of how to do this.

[Example webpack config](https://github.com/imorente/netlify-functions-example/blob/master/webpack.development.config):

```js
module.exports = {
  mode: 'development',
  devServer: {
    proxy: {
      "/.netlify": {
        target: "http://localhost:9000",
        pathRewrite: {"^/.netlify/functions" : ""}
      }
    }
  }
}
```

## Webpack Configuration

By default the webpack configuration uses `babel-loader` to load all js files. Any `.babelrc` in the directory `netlify-lambda` is run from will be respected. If no `.babelrc` is found, a [few basic settings are used](https://github.com/netlify/netlify-lambda/blob/master/lib/build.js#L11-L15a).

If you need to use additional webpack modules or loaders, you can specify an additional webpack config with the `-c` option when running either `serve` or `build`.

The additional webpack config will be merged into the default config via [webpack-merge's](https://www.npmjs.com/package/webpack-merge) `merge.smart` method.

## License

[MIT](LICENSE)
