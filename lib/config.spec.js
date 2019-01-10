var conf = require('./config');

beforeAll(function() {
  process.env.CONTEXT = 'branch-deploy';
  process.env.BRANCH = 'foo-branch';
});

describe('loadContext', function() {
  it('should merge in context config', function() {
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
