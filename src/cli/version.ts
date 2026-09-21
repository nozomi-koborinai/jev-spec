import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = 'jev-spec';

/**
 * Reads the version from the nearest package.json that belongs to this package.
 * Walking up keeps this correct for both the published layout (dist/cli) and test builds.
 */
export async function readPackageVersion(): Promise<string> {
  let dir = path.dirname(fileURLToPath(import.meta.url));

  for (;;) {
    try {
      const manifest = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf-8')) as {
        name?: string;
        version?: string;
      };
      if (manifest.name === PACKAGE_NAME && manifest.version) {
        return manifest.version;
      }
    } catch {
      // no readable package.json at this level, keep walking up
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not locate the ${PACKAGE_NAME} package.json`);
    }
    dir = parent;
  }
}
