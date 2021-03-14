const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const fetch = require('node-fetch');
const serve = require('./serve');

jest.mock('./config', () => {
  const path = require('path');
  return {
    load: jest.fn(() => ({
      build: { functions: path.join('.temp', 'install', 'lambda') },
    })),
    loadContext: jest.fn(() => ({ environment: {} })),
  };
});

jest.spyOn(console, 'log');

describe('serve', () => {
  describe('listen', () => {
    const functionsBuildOutputDir = require('./config').load().build.functions;

    beforeEach(() => {
      fs.mkdirSync(functionsBuildOutputDir, { recursive: true });
    });

    afterEach(() => {
      rimraf.sync(functionsBuildOutputDir);
    });

    it('should route requests to lambda function', async () => {
      const handler = `
        exports.handler = async function(event, context) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: "Hello, World" })
            }
        }
        `;

      fs.writeFileSync(
        path.join(functionsBuildOutputDir, 'hello-world.js'),
        handler,
      );

      const { stopServer } = await serve.listen(9000, false, 10);

      const { message } = await fetch(
        'http://localhost:9000/.netlify/functions/hello-world',
      ).then((r) => r.json());

      expect(message).toEqual('Hello, World');

      stopServer();
    });
  });
});
