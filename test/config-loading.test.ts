import { describe, test as it, after } from 'node:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect } from './test-utils.js';
import { loadConfig } from '../src/config.js';

const CONFIG_SOURCE = `import { defineConfig, noul } from 'jev-spec';

export default defineConfig({
  client: { mock: true },
  zones: {
    core: {
      specPath: 'docs/spec.md',
      codePaths: ['src/**/*.ts'],
      rubrics: { exportsA: noul('Does the module export the constant a?') },
      assertions: { exportsA: { minProbability: 0.8 } },
    },
  },
});
`;

describe('loading a configuration that imports from "jev-spec"', () => {
  const tempDirs: string[] = [];

  /**
   * A project outside this repository with no node_modules: exactly what `npx jev-spec`
   * or `bunx jev-spec` sees when jev-spec is not installed locally.
   */
  const makeBareProject = async (configFileName: string): Promise<string> => {
    const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'jev-spec-bare-')));
    tempDirs.push(dir);
    await fs.writeFile(path.join(dir, configFileName), CONFIG_SOURCE, 'utf-8');
    return dir;
  };

  after(async () => {
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it('resolves the DSL import for a TypeScript config without a local installation', async () => {
    const dir = await makeBareProject('jev-spec.config.ts');

    const config = await loadConfig(undefined, dir);

    expect(config.zones.core.rubrics.exportsA).toEqual({
      type: 'noul',
      question: 'Does the module export the constant a?',
    });
  });

  it('resolves the DSL import for an ESM JavaScript config without a local installation', async () => {
    const dir = await makeBareProject('jev-spec.config.mjs');

    const config = await loadConfig(undefined, dir);

    expect(config.zones.core.codePaths).toEqual(['src/**/*.ts']);
  });
});
