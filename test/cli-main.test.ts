import { describe, test as it } from 'node:test';
import { main } from '../src/cli/main.js';
import { captureConsole, expect } from './test-utils.js';

describe('CLI entry point', () => {
  it('REQ-EXIT-03: exits with 2, not with 1, when an unexpected internal error escapes', async () => {
    // Reading any property of this argv throws an error that is not a usage error.
    const poisoned = new Proxy([] as string[], {
      get() {
        throw new Error('boom');
      },
    });

    const { result, stderr } = await captureConsole(() => main(poisoned));

    expect(result).toBe(2);
    expect(stderr).toContain('boom');
  });

  it('REQ-EXIT-04: prints the usage text and exits with 0 for --help without loading a configuration', async () => {
    const { result, stdout } = await captureConsole(() => main(['--help']));

    expect(result).toBe(0);
    expect(stdout).toContain('Usage: jev-spec check');
  });
});
