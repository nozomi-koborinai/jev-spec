import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
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

async function importConfigModule(resolvedPath: string): Promise<unknown> {
  if (resolvedPath.endsWith('.ts')) {
    const jiti = createJiti(import.meta.url, {
      interopDefault: true,
    });
    const imported = await jiti.import(resolvedPath);
    if (imported && typeof imported === 'object' && 'default' in imported) {
      return (imported as { default: unknown }).default;
    }
    return imported;
  }

  const fileUrl = pathToFileURL(resolvedPath).href;
  const imported = await import(fileUrl);
  return imported.default ?? imported;
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
