import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import type { JevSpecConfig } from './types.js';
import { assertInsideRoot } from './context/path-security.js';

export const DEFAULT_CONFIG_FILENAMES = [
  'jev-spec.config.ts',
  'jev-spec.config.js',
  'jev-spec.config.mjs',
  'spec-verify.config.ts',
  'spec-verify.config.js',
];

export async function findConfigFile(cwd: string = process.cwd()): Promise<string | null> {
  for (const filename of DEFAULT_CONFIG_FILENAMES) {
    const fullPath = path.resolve(cwd, filename);
    try {
      await fs.access(fullPath);
      return fullPath;
    } catch {
      // not found, check next
    }
  }
  return null;
}

/** Entry point of the running jev-spec package (dist/index.js next to this file). */
const SELF_ENTRY = fileURLToPath(new URL('./index.js', import.meta.url));

async function importConfigModule(resolvedPath: string): Promise<unknown> {
  // `import { defineConfig } from 'jev-spec'` must resolve even when jev-spec is not installed
  // in the project (npx / bunx / global install), so the specifier is aliased to this package.
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    alias: { 'jev-spec': SELF_ENTRY },
  });
  const imported = await jiti.import(resolvedPath);
  if (imported && typeof imported === 'object' && 'default' in imported) {
    return (imported as { default: unknown }).default;
  }
  return imported;
}

export async function loadConfig(
  configPath?: string,
  cwd: string = process.cwd()
): Promise<JevSpecConfig> {
  let resolvedPath: string | null;

  if (configPath) {
    resolvedPath = await assertInsideRoot(cwd, configPath);
  } else {
    const found = await findConfigFile(cwd);
    resolvedPath = found ? await assertInsideRoot(cwd, found) : null;
  }

  if (!resolvedPath) {
    throw new Error(
      `Could not find jev-spec configuration file in ${cwd}. Tried: ${DEFAULT_CONFIG_FILENAMES.join(', ')}`
    );
  }

  const config = await importConfigModule(resolvedPath);

  if (!config || typeof config !== 'object' || !('zones' in config)) {
    throw new Error(`Invalid configuration in ${resolvedPath}: "zones" object is required.`);
  }

  return config as JevSpecConfig;
}
