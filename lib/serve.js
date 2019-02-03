var express = require('express');
var bodyParser = require('body-parser');
var expressLogging = require('express-logging');
var queryString = require('querystring');
var path = require('path');
var conf = require('./config');
var jwtDecode = require('jwt-decode');

function handleErr(err, response) {
  response.statusCode = 500;
  response.write('Function invocation failed: ' + err.toString());
  response.end();
  console.log('Error during invocation: ', err);
  return;
}

function createCallback(response) {
  return function callback(err, lambdaResponse) {
    if (err) {
      return handleErr(err, response);
    }

    response.statusCode = lambdaResponse.statusCode;
    for (const key in lambdaResponse.headers) {
      response.setHeader(key, lambdaResponse.headers[key]);
    }

    if (lambdaResponse.body) {
      response.write(
        lambdaResponse.isBase64Encoded
          ? Buffer.from(lambdaResponse.body, 'base64')
          : lambdaResponse.body
      );
    } else {
      if (
        process.env.CONTEXT !== 'production' ||
        !process.env.SILENCE_EMPTY_LAMBDA_WARNING
      )
        console.log(
          `Your lambda function didn't return a body, which may be a mistake. Check our Usage docs for examples (https://github.com/netlify/netlify-lambda#usage). 
          If this is intentional, you can silence this warning by setting process.ENV.SILENCE_EMPTY_LAMBDA_WARNING to a truthy value or process.env.CONTEXT to 'production'`
        );
    }
    response.end();
  };
}

function promiseCallback(promise, callback) {
  if (!promise) return;
  if (typeof promise.then !== 'function') return;
  if (typeof callback !== 'function') return;

  promise.then(
    function(data) {
      callback(null, data);
    },
    function(err) {
      callback(err, null);
    }
  );
}

function buildClientContext(headers) {
  // inject a client context based on auth header https://github.com/netlify/netlify-lambda/pull/57
  if (!headers['authorization']) return;

  const parts = headers['authorization'].split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return;

  try {
    return {
      identity: {
        url: 'NETLIFY_LAMBDA_LOCALLY_EMULATED_IDENTITY_URL',
        token: 'NETLIFY_LAMBDA_LOCALLY_EMULATED_IDENTITY_TOKEN'
      },
      user: jwtDecode(parts[1])
    };
  } catch (e) {
    return; // Ignore errors - bearer token is not a JWT, probably not intended for us
  }
}

function createHandler(dir, static) {
  return function(request, response) {
    // handle proxies without path re-writes (http-servr)
    var cleanPath = request.path.replace(/^\/.netlify\/functions/, '');

    var func = cleanPath.split('/').filter(function(e) {
      return e;
    })[0];
    var module = path.join(process.cwd(), dir, func);
    if (static) {
      delete require.cache[require.resolve(module)];
    }
    var handler;
    try {
      handler = require(module);
    } catch (err) {
      handleErr(err, response);
      return;
    }

    var isBase64 =
      request.body &&
      !(request.headers['content-type'] || '').match(
        /text|application|multipart\/form-data/
      );
    var lambdaRequest = {
      path: request.path,
      httpMethod: request.method,
      queryStringParameters: queryString.parse(request.url.split(/\?(.+)/)[1]),
      headers: request.headers,
      body: isBase64
        ? Buffer.from(request.body.toString(), 'utf8').toString('base64')
        : request.body,
      isBase64Encoded: isBase64
    };

    var callback = createCallback(response);

    var promise = handler.handler(
      lambdaRequest,
      { clientContext: buildClientContext(request.headers) || {} },
      callback
    );
    promiseCallback(promise, callback);
  };
}

exports.listen = function(port, static) {
  var config = conf.load();
  var app = express();
  var dir = config.build.functions || config.build.Functions;
  app.use(bodyParser.raw({ limit: '6mb' }));
  app.use(bodyParser.text({ limit: '6mb', type: '*/*' }));
  app.use(
    expressLogging(console, {
      blacklist: ['/favicon.ico']
    })
  );

  app.get('/favicon.ico', function(req, res) {
    res.status(204).end();
  });
  app.all('*', createHandler(dir, static));

  app.listen(port, function(err) {
    if (err) {
      console.error('Unable to start lambda server: ', err);
      process.exit(1);
    }

    console.log(`Lambda server is listening on ${port}`);
  });

  return {
    clearCache: function(chunk) {
      var module = path.join(process.cwd(), dir, chunk);
      delete require.cache[require.resolve(module)];
    }
  };
};
