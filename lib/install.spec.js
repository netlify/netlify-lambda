const path = require('path');
const install = require('./install');

jest.mock('child_process');

describe('install', () => {
  describe('run', () => {
    it('should merge in context config', async () => {
      const cp = require('child_process');
      cp.exec.mockReturnValue();

      await install.run('.');

      expect(cp.exec).toHaveBeenCalledTimes(1);
      expect(cp.exec).toHaveBeenCalledWith(
        'npm i',
        { cwd: path.resolve('.') },
        expect.any(Function),
      );
    });
  });
});
