## Netlify Lambda

This is an optional tool that helps with building or locally developing [Netlify Functions](https://www.netlify.com/docs/functions/) with a simple webpack/babel build step.

The goal is to make it easy to write Lambda's with transpiled JS/Typescipt features and imported modules.

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
- Every function needs to be a top-level js/ts/mjs file. You can have subfolders inside the `netlify-lambda` folder, but those are only for supporting files to be imported by your top level function.
- Function signatures follow the [AWS event handler](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html) syntax but must be named `handler`. [We use Node v8](https://www.netlify.com/blog/2018/04/03/node.js-8.10-now-available-in-netlify-functions/) so `async` functions **are** supported ([beware common mistakes](https://serverless.com/blog/common-node8-mistakes-in-lambda/)!). Read [Netlify Functions docs](https://www.netlify.com/docs/functions/#javascript-lambda-functions) for more info.

## Using with `create-react-app`, Gatsby, and other development servers

`react-scripts` (the underlying library for `create-react-app`) and other popular development servers often set up catchall serving for you; in other words, if you try to request a route that doesn't exist, the dev server will try to serve you `/index.html`. This is problematic when you are trying to hit a local API endpoint like `netlify-lambda` sets up for you - your browser will attempt to parse the `index.html` file as JSON. This is why you may see this error:

`Uncaught (in promise) SyntaxError: Unexpected token < in JSON at position 0`

If this desribes your situation, then you need to proxy for local development. Read on. Don't worry it's easier than it looks.

### Proxying for local development

> ⚠️IMPORTANT! PLEASE READ THIS ESPECIALLY IF YOU HAVE CORS ISSUES⚠️

When your function is deployed on Netlify, it will be available at `/.netlify/functions/function-name` for any given deploy context. It is advantageous to proxy the `netlify-lambda serve` development server to the same path on your primary development server.

Say you are running `webpack-serve` on port 8080 and `netlify-lambda serve` on port 9000. Mounting `localhost:9000` to `/.netlify/functions/` on your `webpack-serve` server (`localhost:8080/.netlify/functions/`) will closely replicate what the final production environment will look like during development, and will allow you to assume the same function url path in development and in production.

- If you are using with `create-react-app`, see [netlify/create-react-app-lambda](https://github.com/netlify/create-react-app-lambda/blob/f0e94f1d5a42992a2b894bfeae5b8c039a177dd9/src/setupProxy.js) for an example of how to do this with `create-react-app`. [setupProxy is partially documented in the CRA docs](https://facebook.github.io/create-react-app/docs/proxying-api-requests-in-development#configuring-the-proxy-manually). You can also learn how to do this from scratch in a video: https://www.youtube.com/watch?v=3ldSM98nCHI 
- If you are using Gatsby, see [their Advanced Proxying docs](https://www.gatsbyjs.org/docs/api-proxy/#advanced-proxying). This is implemented in the [JAMstack Hackathon Starter](https://github.com/sw-yx/jamstack-hackathon-starter), and here is an accompanying blogpost: [Turning the Static Dynamic: Gatsby + Netlify Functions + Netlify Identity](https://www.gatsbyjs.org/blog/2018-12-17-turning-the-static-dynamic/).
- If you are using Next.js, see [this issue for how to proxy](https://github.com/netlify/netlify-lambda/pull/28#issuecomment-439675503).
- If you are using Vue CLI, you may just use https://github.com/netlify/vue-cli-plugin-netlify-lambda/.
- If you are using with Angular CLI, see the instructions below.

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

<details>
  <summary>
**Using with `Angular CLI`**
  </summary>

CORS issues when trying to use netlify-lambdas locally with angular? you need to set up a proxy.

Firstly make sure you are using relative paths in your app to ensure that your app will work locally and on Netlify, example below...

```js
  this.http.get('/.netlify/functions/jokeTypescript')
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

## Webpack Configuration

By default the webpack configuration uses `babel-loader` to load all js files. Any `.babelrc` in the directory `netlify-lambda` is run from will be respected. If no `.babelrc` is found, a [few basic settings are used](https://github.com/netlify/netlify-lambda/blob/master/lib/build.js#L11-L15a).

If you need to use additional webpack modules or loaders, you can specify an additional webpack config with the `-c`/`--config` option when running either `serve` or `build`. See this issue for an example of [how to write a webpack override file](https://github.com/netlify/netlify-lambda/issues/64).

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
    [
      "@babel/preset-env",
      {
        "targets": {
          "node": "6.10.3"
        }
      }
    ]
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
```

### --port option

The serving port can be changed with the `-p`/`--port` option.

### --static option

If you need an escape hatch and are building your lambda in some way that is incompatible with our build process, you can skip the build with the `-s` or `--static` flag. [More info here](https://github.com/netlify/netlify-lambda/pull/62).

## Debugging

To debug lambdas, prepend the `serve` command with [npm's package runner npx](https://medium.com/@maybekatz/introducing-npx-an-npm-package-runner-55f7d4bd282b) `npx --node-arg=--inspect netlify-lambda serve ...`. Additionally:

1. make sure that sourcemaps are built along the way (e.g. in the webpack configuration and the `tsconfig.json` if typescript is used) 
2. webpack's uglification is turned off with `optimization: { minimize: false }`. If using VSCode,  it is likely that the `sourceMapPathOverrides` have to be adapted for breakpoints to work.

Netlify Functions [run in Node v8.10](https://www.netlify.com/blog/2018/04/03/node.js-8.10-now-available-in-netlify-functions/) and you may need to run the same version to mirror the environment locally. Also make sure to check that you aren't [committing one of these common Node 8 mistakes in Lambda!](https://serverless.com/blog/common-node8-mistakes-in-lambda/)

Don't forget to search our issues in case someone has run into a similar problem you have!

## Netlify Identity

Make sure to [read the docs](https://www.netlify.com/docs/functions/#identity-and-functions) on how Netlify Functions and Netlify Identity work together. Basically you have to make your request with an `authorization` header and a `Bearer` token with your Netlify Identity JWT supplied. You can get this JWT from any of our Identity solutions from [gotrue-js](https://github.com/netlify/gotrue-js) to [netlify-identity-widget](https://github.com/netlify/netlify-identity-widget).

Since for practical purposes we cannot fully emulate Netlify Identity locally, we provide [simple JWT decoding inside the `context` of your function](https://github.com/netlify/netlify-lambda/pull/57). This will give you back the `user` info you need to work with.

Minor note: For the `identity` field, since we are not fully emulating Netlify Identity, we can't give you details on the Identity instance, so we give you [unambiguous strings](https://github.com/netlify/netlify-lambda/blob/master/lib/serve.js#L87) so you know not to rely on it locally: `NETLIFY_LAMBDA_LOCALLY_EMULATED_IDENTITY_URL` and `NETLIFY_LAMBDA_LOCALLY_EMULATED_IDENTITY_TOKEN`. In production, of course, Netlify Functions will give you the correct `identity.url` and `identity.token` fields. We find we dont use this info often in our functions so it is not that big of a deal in our judgment.

## Example functions and Tutorials

You can do a great deal with lambda functions! Here are some examples for inspiration:

- Basic Netlify Functions tutorial: https://flaviocopes.com/netlify-functions/
- Netlify's list of Function examples: https://functions-playground.netlify.com/ ([Even more in the README](https://github.com/netlify/functions))
- Slack Notifications: https://css-tricks.com/forms-auth-and-serverless-functions-on-gatsby-and-netlify/#article-header-id-9
- URL Shortener: https://www.netlify.com/blog/2018/03/19/create-your-own-url-shortener-with-netlifys-forms-and-functions/
- Gatsby + Netlify Identity + Functions: [Turning the Static Dynamic: Gatsby + Netlify Functions + Netlify Identity](https://www.gatsbyjs.org/blog/2018-12-17-turning-the-static-dynamic/)
- Raymond Camden's [Adding Serverless Functions to Your Netlify Static Site](https://www.raymondcamden.com/2019/01/08/adding-serverless-functions-to-your-netlify-static-site)
- Travis Horn's [Netlify Lambda Functions from Scratch](https://travishorn.com/netlify-lambda-functions-from-scratch-1186f61c659e)
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

## License

[MIT](LICENSE)
