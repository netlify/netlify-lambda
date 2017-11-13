## Netlify Lambda CLI

This is a small CLI tool that helps with building or serving lambdas built with a simple webpack/babel setup.

The goal is to make it easy to work with Lambda's with modern ES6 without being dependent on having the most state of the art node runtime available in the final deployment environment and with a build that can compile all modules into a single lambda file.

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

## License

[MIT](LICENSE)