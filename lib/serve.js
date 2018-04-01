var express = require("express");
var bodyParser = require("body-parser");
var expressLogging = require("express-logging");
var path = require("path");
var base64 = require("base-64");
var conf = require("./config");

function handleErr(err, response) {
  response.statusCode = 500;
  response.write("Function invocation failed: " + err.toString());
  response.end();
  console.log("Error during invocation: ", err);
  return;
}

function createHandler(dir) {
  return function(request, response) {
    var func = request.path.split("/").filter(function(e) {
      return e;
    })[0];
    var module = path.join(process.cwd(), dir, func);
    var handler;
    try {
      handler = require(module);
    } catch (err) {
      handleErr(err, response);
      return;
    }

    var isBase64 =
      request.body &&
      !(request.headers["content-type"] || "").match(/text|application/);
    var lambdaRequest = {
      path: request.path,
      httpMethod: request.method,
      queryStringParameters: request.query,
      headers: request.headers,
      body: isBase64 ? base64.encode(request.body) : request.body,
      isBase64Encoded: isBase64
    };

    handler.handler(lambdaRequest, {}, function(err, lambdaResponse) {
      if (err) {
        return handleErr(err, response);
      }

      response.statusCode = lambdaResponse.statusCode;
      for (const key in lambdaResponse.headers) {
        response.setHeader(key, lambdaResponse.headers[key]);
      }
      response.write(
        lambdaResponse.isBase64Encoded
          ? base64.decode(lambdaResponse.body)
          : lambdaResponse.body
      );
      response.end();
    });
  };
}

exports.listen = function(port) {
  var config = conf.load();
  var app = express();
  var dir = config.build.functions || config.build.Functions;
  app.use(bodyParser.raw());
  app.use(bodyParser.text({type: "*/*"}));
  app.use(expressLogging(console));

  app.get("/favicon.ico", function(req, res) {
    res.status(204).end();
  });
  app.all("*", createHandler(dir));

  app.listen(port, function(err) {
    if (err) {
      console.error("Unable to start lambda server: ", err);
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
