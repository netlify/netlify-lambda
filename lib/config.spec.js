var conf = require('./config');

beforeAll(function () {
  process.env.CONTEXT = 'branch-deploy';
  process.env.BRANCH = 'foo-branch';
});

jest.mock('fs');

describe('config', () => {
  describe('load', () => {
    it('should load valid netlify.toml file', () => {
      const { readFileSync, existsSync } = require('fs');

      existsSync.mockReturnValue(true);
      readFileSync.mockReturnValue(`
[build]
  command = "echo 'no op'"
  publish = "public"
    
  functions = "functions/"
    
  [build.environment]
    NODE_VERSION = "12"
`);
      conf.load()
      .then(config => expect(config).toEqual({
        build: {
          command: "echo 'no op'",
          publish: 'public',
          functions: 'functions/',

          environment: {
            NODE_VERSION: '12',
          },
        },
      }))
      .catch(err => { 
        throw err
      })
    });
  });

  describe('loadContext', function () {
    it('should merge in context config', function () {
      var config = {
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
      var contextConfig = conf.loadContext(config);
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
