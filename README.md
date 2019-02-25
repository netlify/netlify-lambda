## Netlify Lambda

This is an optional tool that helps with building or locally developing [Netlify Functions](https://www.netlify.com/docs/functions/) with a simple webpack/babel build step.

The goal is to make it easy to write Lambda's with transpiled JS/TypeScript features and imported modules.

## New Alternative to Netlify Lambda

Netlify-Lambda uses webpack to bundle up your functions and their dependencies for you, however this is not the only approach. If you have native node modules (or other dependencies that don't expect to be bundled like [the Firebase SDK](https://github.com/netlify/netlify-lambda/issues/112)) then you may want to try the zipping approach.

We have recently integrated this functionality ([zip-it-and-ship-it](https://github.com/netlify/zip-it-and-ship-it)) into the Netlify CLI. Check the [documentation here](https://www.netlify.com/docs/cli/#unbundled-javascript-function-deploys) in the official CLI docs and support is available through [our regular channels](https://www.netlify.com/support/). The current drawback of this approach is no ability to serve these zipped functions locally, although we are working on this.

<details>
  <summary><b>A bit information on manual zipping</b></summary>
  
 You can still zip up and deploy functions by yourself, as has always been the case with Netlify Functions. Read [here](https://www.netlify.com/blog/2018/09/14/forms-and-functions/) and [here for instructions](https://github.com/DavidWells/function-zips/) (more examples [here](https://github.com/netlify/function-bundling-example))
  </details>
  
Look out for more announcements on this in coming months.

## Installation

**We recommend installing locally** rather than globally:

```bash
yarn add -D netlify-lambda
```

This will ensure your build scripts don't assume a global install which is better for your CI/CD (for example with Netlify's buildbot).

If you don't have a [`netlify.toml`](https://www.netlify.com/docs/netlify-toml-reference/) file, you'll need one ([example](https://github.com/netlify/create-react-app-lambda/blob/master/netlify.toml)). Define the `functions` field where the functions will be built to and served from, e.g.

```toml
# example netlify.toml
[build]
  command = "yarn build"
  functions = "lambda" #  netlify-lambda reads this
  publish = "build"
```

## Usage

We expose two commands:

```
netlify-lambda serve <folder>
netlify-lambda build <folder>
```

At a high level, `netlify-lambda` takes a source folder (e.g. `src/lambda`, specified in your command) and outputs it to a built folder, (e.g. `built-lambda`, specified in your `netlify.toml` file).

The `build` function will run a single build of the functions in the folder.

The `serve` function will start a dev server for the source folder and route requests with a `.netlify/functions/` prefix, with a default port of `9000`:

```
folder/hello.js -> http://localhost:9000/.netlify/functions/hello
```

It also watches your files and restarts the dev server on change. Note: if you add a new file you should kill and restart the process to pick up the new file.

**IMPORTANT**:

- You need a [`netlify.toml`](https://www.netlify.com/docs/netlify-toml-reference/) file with a `functions` field.
- Every function needs to be a top-level js/ts/mjs file. You can have subfolders inside the `netlify-lambda` folder, but those are only for supporting files to be imported by your top level function. Files that end with `.spec.*` or `.test.*` will be ignored so you can [colocate your tests](https://github.com/netlify/netlify-lambda/issues/99).
- Function signatures follow the [AWS event handler](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html) syntax but must be named `handler`. [We use Node v8](https://www.netlify.com/blog/2018/04/03/node.js-8.10-now-available-in-netlify-functions/) so `async` functions **are** supported ([beware common mistakes](https://serverless.com/blog/common-node8-mistakes-in-lambda/)!). Read [Netlify Functions docs](https://www.netlify.com/docs/functions/#javascript-lambda-functions) for more info.
- Functions [time out in 10 seconds](https://www.netlify.com/docs/functions/#custom-deployment-options) by default although extensions can be requested. We [try to replicate this locally](https://github.com/netlify/netlify-lambda/pull/116).

<details>
  <summary><b>Environment variables in build and branch context</b></summary>

Read Netlify's [documentation on environment variables](https://www.netlify.com/docs/continuous-deployment/#build-environment-variables).
`netlify-lambda` should respect the env variables you supply in `netlify.toml` accordingly (except for deploy previews, which make no sense to locally emulate).

However, this is a [relatively new feature](https://github.com/netlify/netlify-lambda/issues/59), so if you encounter issues, file one.

If you need local-only environment variables that you don't place in `netlify.toml` for security reasons, you can configure webpack to use a `.env` file [like in this example](https://github.com/netlify/netlify-lambda/issues/118).

</details>

  <summary>
    <b>Lambda function examples</b>
  </summary>
  If you are new to writing Lambda functions, this section may help you. Function signatures should conform to one of either two styles. Traditional callback style:
  
  ```js
exports.handler = function(event, context, callback) {
  // your server-side functionality
  callback(null, {
    statusCode: 200,
    body: JSON.stringify({
      message: `Hello world ${Math.floor(Math.random() * 10)}`
    })
  });
};
  ```
  
  or you can use async/await:
  
  ```js
export async function handler(event, context) {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Hello world ${Math.floor(Math.random() * 10)}` })
    };
}
  ```
  
  For more Functions examples, check:
  
  - https://functions-playground.netlify.com/ (introductory)
  - https://functions.netlify.com/examples/ (our firehose of all functions examples)
  - the blogposts at the bottom of this README
  
  </details>

## Using with `create-react-app`, Gatsby, and other development servers

<details>
<summary><b>Why you need to proxy (for beginners)</b></summary>

`react-scripts` (the underlying library for `create-react-app`) and other popular development servers often set up catchall serving for you; in other words, if you try to request a route that doesn't exist, the dev server will try to serve you `/index.html`. This is problematic when you are trying to hit a local API endpoint like `netlify-lambda` sets up for you - your browser will attempt to parse the `index.html` file as JSON. This is why you may see this error:

`Uncaught (in promise) SyntaxError: Unexpected token < in JSON at position 0`

If this desribes your situation, then you need to proxy for local development. Read on. Don't worry it's easier than it looks.

</details>

### Proxying for local development

> ⚠️IMPORTANT! PLEASE READ THIS ESPECIALLY IF YOU HAVE CORS ISSUES⚠️

When your function is deployed on Netlify, it will be available at `/.netlify/functions/function-name` for any given deploy context. It is advantageous to proxy the `netlify-lambda serve` development server to the same path on your primary development server.

Say you are running `webpack-serve` on port 8080 and `netlify-lambda serve` on port 9000. Mounting `localhost:9000` to `/.netlify/functions/` on your `webpack-serve` server (`localhost:8080/.netlify/functions/`) will closely replicate what the final production environment will look like during development, and will allow you to assume the same function url path in development and in production.

- If you are using with `create-react-app`, see [netlify/create-react-app-lambda](https://github.com/netlify/create-react-app-lambda/blob/f0e94f1d5a42992a2b894bfeae5b8c039a177dd9/src/setupProxy.js) for an example of how to do this with `create-react-app`. [setupProxy is partially documented in the CRA docs](https://facebook.github.io/create-react-app/docs/proxying-api-requests-in-development#configuring-the-proxy-manually). You can also learn how to do this from scratch in a video: https://www.youtube.com/watch?v=3ldSM98nCHI
- If you are using Gatsby, see [their Advanced Proxying docs](https://www.gatsbyjs.org/docs/api-proxy/#advanced-proxying). This is implemented in the [JAMstack Hackathon Starter](https://github.com/sw-yx/jamstack-hackathon-starter), and here is an accompanying blogpost: [Turning the Static Dynamic: Gatsby + Netlify Functions + Netlify Identity](https://www.gatsbyjs.org/blog/2018-12-17-turning-the-static-dynamic/).
- If you are using React-Static, check https://github.com/nozzle/react-static/issues/380.
- If you are using Nuxt.js, see [this issue for how to proxy](https://github.com/netlify/netlify-lambda/pull/28#issuecomment-439675503).
- If you are using Vue CLI, you may just use https://github.com/netlify/vue-cli-plugin-netlify-lambda/.
- If you are using with Angular CLI, see the instructions below.

[Example webpack config](https://github.com/imorente/netlify-functions-example/blob/master/webpack.development.config):

```js
module.exports = {
  mode: 'development',
  devServer: {
    proxy: {
      '/.netlify': {
        target: 'http://localhost:9000',
        pathRewrite: { '^/.netlify/functions': '' }
      }
    }
  }
};
```

<details>
  <summary>
    <b>Using with <code>Angular CLI</code></b>
  </summary>

CORS issues when trying to use netlify-lambdas locally with angular? you need to set up a proxy.

Firstly make sure you are using relative paths in your app to ensure that your app will work locally and on Netlify, example below...

```js
this.http.get('/.netlify/functions/jokeTypescript');
```

Then place a `proxy.config.json` file in the root of your project, the contents should look something like...

```json
{
  "/.netlify/functions/*": {
    "target": "http://localhost:9000",
    "secure": false,
    "logLevel": "debug",
    "changeOrigin": true
  }
}
```

- The `key` should match up with the location of your Transpiled `functions` as defined in your `netlify.toml`
- The `target` should match the port that the lambdas are being served on (:9000 by default)

When you run up your Angular project you need to pass in the proxy config with the flag `--proxy-config` like so...

```bash
  ng serve --proxy-config proxy.config.json
```

To make your life easier you can add these to your `scripts` in `package.json`

```json
  "scripts": {
    "start": "ng serve --proxy-config proxy.config.json",
    "build": "ng build --prod --aot && yarn nlb",
    "nls": "netlify-lambda serve src_functions",
    "nlb": "netlify-lambda build src_functions"
  }
```

Obviously you need to run up `netlify-lambda` & `angular` at the same time.

</details>
<details>
  <summary>
    <b>Using with <code>Next.js</code></b>
  </summary>

Next.js [doesnt use Webpack Dev Server](https://github.com/zeit/next.js/issues/2281), so you can't modify any config in `next.config.js` to get a proxy to run. However, since the CORS proxy issue only happens in dev mode (Functions are on the same domain when deployed on Netlify) you can run Next.js through a Node server for local development:

```js
touch server.js
yarn add -D http-proxy-middleware express
```

```js
// server.js
/* eslint-disable no-console */
const express = require('express');
const next = require('next');

const devProxy = {
  '/.netlify': {
    target: 'http://localhost:9000',
    pathRewrite: { '^/.netlify/functions': '' }
  }
};

const port = parseInt(process.env.PORT, 10) || 3000;
const env = process.env.NODE_ENV;
const dev = env !== 'production';
const app = next({
  dir: '.', // base directory where everything is, could move to src later
  dev
});

const handle = app.getRequestHandler();

let server;
app
  .prepare()
  .then(() => {
    server = express();

    // Set up the proxy.
    if (dev && devProxy) {
      const proxyMiddleware = require('http-proxy-middleware');
      Object.keys(devProxy).forEach(function(context) {
        server.use(proxyMiddleware(context, devProxy[context]));
      });
    }

    // Default catch-all handler to allow Next.js to handle all other routes
    server.all('*', (req, res) => handle(req, res));

    server.listen(port, err => {
      if (err) {
        throw err;
      }
      console.log(`> Ready on port ${port} [${env}]`);
    });
  })
  .catch(err => {
    console.log('An error occurred, unable to start the server');
    console.log(err);
  });

```

run your server and netlify-lambda at the same time:

```js
// package.json
  "scripts": {
    "start": "cross-env NODE_ENV=dev npm-run-all --parallel start:app start:server",
    "start:app": "PORT=3000 node server.js",
    "start:server": "netlify-lambda serve functions"
  },
```

and now you can ping Netlify Functions with locally emulated by `netlify-lambda`!

For production deployment, you have two options:

- [using `next export` to do static HTML export](https://nextjs.org/docs/#static-html-export)
- [using the Next.js 8 `serverless` target option](https://nextjs.org/blog/next-8/#serverless-nextjs) to run your site in a function as well.

Just remember to configure your `netlify.toml` to point to the `Next.js` build folder and your `netlify-lambda` functions folder accordingly.

</details>

## Webpack Configuration

By default the webpack configuration uses `babel-loader` to load all js files. Any `.babelrc` in the directory `netlify-lambda` is run from will be respected. If no `.babelrc` is found, a [few basic settings are used](https://github.com/netlify/netlify-lambda/blob/master/lib/build.js#L11-L15a).

If you need to use additional webpack modules or loaders, you can specify an additional webpack config with the `-c`/`--config` option when running either `serve` or `build`.

For example, have a file with:

```js
// webpack.functions.js
module.exports = {
  optimization: { minimize: false }
};
```

Then specify `netlify-lambda serve --config ./webpack.functions.js`. If using VSCode, it is likely that the `sourceMapPathOverrides` have to be adapted for breakpoints to work. Read here for more info on [how to modify the webpack config](https://github.com/netlify/netlify-lambda/issues/64#issuecomment-429625191).

The additional webpack config will be merged into the default config via [webpack-merge's](https://www.npmjs.com/package/webpack-merge) `merge.smart` method.

### Babel configuration

The default webpack configuration uses `babel-loader` with a [few basic settings](https://github.com/netlify/netlify-lambda/blob/master/lib/build.js#L19-L33).

However, if any `.babelrc` is found in the directory `netlify-lambda` is run from, or [folders above it](https://github.com/netlify/netlify-lambda/pull/92) (useful for monorepos), it will be used instead of the default one.

If you need to run different babel versions for your lambda and for your app, [check this issue](https://github.com/netlify/netlify-lambda/issues/34) to override your webpack babel-loader.

### Use with TypeScript

We added `.ts` and `.mjs` support recently - [check here for the PR and usage tips](https://github.com/netlify/netlify-lambda/pull/76).

1. Install `@babel/preset-typescript`

```bash
npm install --save-dev @babel/preset-typescript
```

You may also want to add `typescript @types/node @types/aws-lambda`.

2. Create a custom `.babelrc` file:

```diff
{
  "presets": [
    "@babel/preset-typescript",
    "@babel/preset-env"
  ],
  "plugins": [
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-transform-object-assign",
    "@babel/plugin-proposal-object-rest-spread"
  ]
}
```

3. (Optional) if you have `@types/aws-lambda` installed, your lambda functions can use the community typings for `Handler, Context, Callback`. See the typescript instructions in [create-react-app-lambda](https://github.com/netlify/create-react-app-lambda/blob/master/README.md#typescript) for an example.

Check https://github.com/sw-yx/create-react-app-lambda-typescript for a CRA + Lambda full Typescript experience.

## CLI flags/options

There are additional CLI options:

```bash
-h --help
-c --config
-p --port
-s --static
-t --timeout
```

### --config option

If you need to use additional webpack modules or loaders, you can specify an additional webpack config with the `-c`/`--config` option when running either `serve` or `build`.

For example, have a file with:

```js
// webpack.functions.js
module.exports = {
  optimization: { minimize: false }
};
```

Then specify `netlify-lambda serve --config ./webpack.functions.js`.

### --timeout option

(This is for local dev/serving only) The default function timeout is 10 seconds. If you need to adjust this because you have requested extra timeout, pass a timeout number here. Thanks to [@naipath](https://github.com/netlify/netlify-lambda/pull/116) for this feature.

### --port option

The serving port can be changed with the `-p`/`--port` option.

### --static option

If you need an escape hatch and are building your lambda in some way that is incompatible with our build process, you can skip the build with the `-s` or `--static` flag. [More info here](https://github.com/netlify/netlify-lambda/pull/62).

## Netlify Identity

Make sure to [read the docs](https://www.netlify.com/docs/functions/#identity-and-functions) on how Netlify Functions and Netlify Identity work together. Basically you have to make your request with an `authorization` header and a `Bearer` token with your Netlify Identity JWT supplied. You can get this JWT from any of our Identity solutions from [gotrue-js](https://github.com/netlify/gotrue-js) to [netlify-identity-widget](https://github.com/netlify/netlify-identity-widget).

Since for practical purposes we cannot fully emulate Netlify Identity locally, we provide [simple JWT decoding inside the `context` of your function](https://github.com/netlify/netlify-lambda/pull/57). This will give you back the `user` info you need to work with.

Minor note: For the `identity` field, since we are not fully emulating Netlify Identity, we can't give you details on the Identity instance, so we give you [unambiguous strings](https://github.com/netlify/netlify-lambda/blob/master/lib/serve.js#L87) so you know not to rely on it locally: `NETLIFY_LAMBDA_LOCALLY_EMULATED_IDENTITY_URL` and `NETLIFY_LAMBDA_LOCALLY_EMULATED_IDENTITY_TOKEN`. In production, of course, Netlify Functions will give you the correct `identity.url` and `identity.token` fields. We find we dont use this info often in our functions so it is not that big of a deal in our judgment.

## Debugging

To debug lambdas, you can use the `--inspect` flag. Additionally:

1. make sure that sourcemaps are built along the way (e.g. in the webpack configuration and the `tsconfig.json` if typescript is used)
2. webpack's minification/uglification is turned off (see below):

For example, have a file with:

```js
// webpack.functions.js
module.exports = {
  optimization: { minimize: false }
};
```

Then specify `netlify-lambda serve --config ./webpack.functions.js`. If using VSCode, it is likely that the `sourceMapPathOverrides` have to be adapted for breakpoints to work. Read here for more info on [how to modify the webpack config](https://github.com/netlify/netlify-lambda/issues/64#issuecomment-429625191).

Netlify Functions [run in Node v8.10](https://www.netlify.com/blog/2018/04/03/node.js-8.10-now-available-in-netlify-functions/) and you may need to run the same version to mirror the environment locally. Also make sure to check that you aren't [committing one of these common Node 8 mistakes in Lambda!](https://serverless.com/blog/common-node8-mistakes-in-lambda/)

**Special warning on `node-fetch`**: `node-fetch` and webpack [currently don't work well together](https://github.com/bitinn/node-fetch/issues/450). You will have to use the default export in your code:

```js
const fetch = require('node-fetch').default // not require('node-fetch')
```

Don't forget to search our issues in case someone has run into a similar problem you have!

## Example functions and Tutorials

You can do a great deal with lambda functions! Here are some examples for inspiration:

- Basic Netlify Functions tutorial: https://flaviocopes.com/netlify-functions/
- Netlify's list of Function examples: https://functions-playground.netlify.com/ ([Even more in the README](https://github.com/netlify/functions) as well as our full list https://functions.netlify.com/examples/)
- Slack Notifications: https://css-tricks.com/forms-auth-and-serverless-functions-on-gatsby-and-netlify/#article-header-id-9
- URL Shortener: https://www.netlify.com/blog/2018/03/19/create-your-own-url-shortener-with-netlifys-forms-and-functions/
- Gatsby + Netlify Identity + Functions: [Turning the Static Dynamic: Gatsby + Netlify Functions + Netlify Identity](https://www.gatsbyjs.org/blog/2018-12-17-turning-the-static-dynamic/)
- Raymond Camden's [Adding Serverless Functions to Your Netlify Static Site](https://www.raymondcamden.com/2019/01/08/adding-serverless-functions-to-your-netlify-static-site)
- Travis Horn's [Netlify Lambda Functions from Scratch](https://travishorn.com/netlify-lambda-functions-from-scratch-1186f61c659e)
- [JAMstack with Divya Sasidharan & Phil Hawksworth | Devchat.tv](https://devchat.tv/js-jabber/jsj-347-jamstack-with-divya-sasidharan-phil-hawksworth/) - Great discussion on the problems that Netlify Functions solve
- [Netlify function error reporting with Sentry](https://httptoolkit.tech/blog/netlify-function-error-reporting-with-sentry/) - automatic error reporting for your Netlify functions, so you know any time they fail.
- React + Stripe + Netlify Functions: [Build and deploy a serverless eCommerce project](https://mitchgavan.com/react-serverless-shop/)
- [**Submit your blogpost here!**](https://github.com/netlify/netlify-lambda/issues/new)

These libraries pair very well for extending your functions capability:

- Middleware: https://github.com/middyjs/middy
- GraphQL: https://www.npmjs.com/package/apollo-server-lambda
- [Any others to suggest?](https://github.com/netlify/netlify-lambda/issues/new)

## Other community approaches

If you wish to serve the full website from lambda, [check this issue](https://github.com/netlify/netlify-lambda/issues/36).

If you wish to run this server for testing, [check this issue](https://github.com/netlify/netlify-lambda/issues/49).

If you wish to emulate more Netlify functionality locally, check this repo: https://github.com/8eecf0d2/netlify-local. We are considering merging the projects [here](https://github.com/netlify/netlify-lambda/issues/75).

All of the above are community maintained and not officially supported by Netlify.

## Changelog

- v1.0: https://twitter.com/Netlify/status/1050399820484087815 Webpack 4 and Babel 7
- v1.1: https://twitter.com/swyx/status/1069544181259849729 Typescript support
- v1.2: https://twitter.com/swyx/status/1083446733374337024 Identity emulation (& others)
- v1.3: https://github.com/netlify/netlify-lambda/releases/tag/v1.3.0
- v1.4: New timeout feature https://github.com/netlify/netlify-lambda/pull/116

## License

[MIT](LICENSE)
