beforeAll(function () {
  process.env.CONTEXT = 'branch-deploy';
  process.env.BRANCH = 'foo-branch';
});

jest.mock('util');

describe('config', () => {
  describe('load', () => {
    it('should load valid netlify.toml file', async () => {
      const { promisify } = require('util');

      const readFile = jest.fn(
        () => `
      [build]
        command = "echo 'no op'"
        publish = "public"
          
        functions = "functions/"
          
        [build.environment]
          NODE_VERSION = "12"
      `,
      );
      promisify.mockReturnValue(readFile);

      const conf = require('./config');
      const config = await conf.load();
      expect(config).toEqual({
        build: {
          command: "echo 'no op'",
          publish: 'public',
          functions: 'functions/',
          environment: {
            NODE_VERSION: '12',
          },
        },
      });
    });
  });

  describe('loadContext', function () {
    it('should merge in context config', function () {
      const config = {
        build: {
          publish: '/default',
          environment: {
            SOME_VAR: true,
          },
        },
        context: {
          'branch-deploy': {
            publish: '/branch-deploy',
            environment: {
              SOME_VAR: false,
            },
          },
          'foo-branch': {
            publish: '/foo-branch',
            environment: {
              SOME_OTHER_VAR: 10,
            },
          },
        },
      };
      const conf = require('./config');
      const contextConfig = conf.loadContext(config);
      expect(contextConfig).toEqual({
        publish: '/foo-branch',
        environment: {
          SOME_VAR: false,
          SOME_OTHER_VAR: 10,
        },
      });
    });
  });
});
