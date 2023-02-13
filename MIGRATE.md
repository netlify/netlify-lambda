# Migration Guide

This guide covers some use cases of netlify-lambda and how to accomplish them without it.

## Running Netlify functions locally

The functionality to have functions run locally has been completely integrated into the Netlify CLI and offers even more functionality like local debugging.

If you had `netlify-lambda` in you npm scripts you can simply migrate by changing to the Netlify CLIs `dev` command.

For example in a theoretical Gatsby project you can migrate with the following changes:

```diff
 {
   "scripts": {
-     "start:app": "npm run develop",
-     "start:lambda": "netlify-lambda serve src/lambda",
-     "start": "concurrently \"yarn start:lambda\" \"yarn develop\"",
-     "develop": "gatsby develop",
+     "start": "netlify dev",
   },
   "devDependencies": {
-    "netlify-lambda": "^1.4.3",
+    "netlify-cli": "^10.14.0",
   }
 }
```

## Using Typescript or non-standard JavaScript features

Netlify now also supports Typescript and non-standard JavaScript features.
For Typescript there is no configuration needed and tit will work out of the box. The same is true if you use ESM modules in your functions. The bundling logic will automatically detect this and use `esbuild` to bundle the function.
In any other case you can enable set the `node_bundler` to `esbuild` yourself for the functions in your `netlify.toml` file. https://docs.netlify.com/configure-builds/file-based-configuration/#functions

Should `esbuild` not work for you usecase then please report this to us or use webpack directly. You can check how this works in the next section.

## Webpack bundling

You might want to give our automated bundling a try (see above).

If you still want to use webpack to bundle your functions, you can simply use webpack yourself and adjust the following config to your needs. This example is for webpack 4, which is the version that netlify-lambda also used.

> package.json

```json
{
    "scripts":{
        "build":"webpack --config ./webpack.config.js"
    }
    "devDependencies": {
        "webpack": "^4.46.0",
        "webpack-cli": "^4.10.0",
        "babel-loader": "^8.2.5",
        "@babel/preset-env": "^7.18.9",
    }
}
```

> webpack.config.js

```js
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  resolve: {
    extensions: ['.wasm', '.mjs', '.js', '.json', '.ts'],
    mainFields: ['module', 'main'],
  },
  module: {
    rules: [
      {
        test: /\.(m?js|ts)?$/,
        exclude: new RegExp(
          `(node_modules|bower_components|\\.(test|spec)\\.?)`,
        ),
        use: {
          loader: require.resolve('babel-loader'),
          options: {
            cacheDirectory: true,
            presets: [
              [
                require.resolve('@babel/preset-env'),
                { targets: { node: '16.6.0' } },
              ],
            ],
          },
        },
      },
    ],
  },
  context: './src/functions',
  entry: {},
  target: 'node',
  plugins: [new webpack.IgnorePlugin(/vertx/)],
  output: {
    path: './netlify/functions',
    filename: '[name].js',
    libraryTarget: 'commonjs',
  },
  optimization: {
    nodeEnv: process.env.NODE_ENV || 'production',
  },
  bail: true,
  devtool: false,
  stats: {
    colors: true,
  },
};
```

## Install function dependencies

Consider moving the dependencies of your functions into your main `package.json`. If this is not possible you can use the following change.

Note that, this is only needed for local development, the Netlify Build System will detect and install dependencies of your functions.

```diff
 {
   "scripts": {
-     "postinstall": "netlify-lambda install",
+     "postinstall": "npm --prefix ./functions/my-function i && npm --prefix ./functions/other-function i",
   },
   "devDependencies": {
-    "netlify-lambda": "^1.4.3",
   }
 }
```
