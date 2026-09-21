import { describe, test as it, after, beforeEach } from 'node:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, captureConsole } from './test-utils.js';
import { checkCommand } from '../src/cli/commands/check.js';
import { parseCliArgs } from '../src/cli/args.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '../..');

const LIVE_CONFIG_SOURCE = `export default {
  zones: {
    auth: {
      specPath: 'test/fixtures/specs/auth-requirements.md',
      codePaths: ['test/fixtures/src/auth.ts'],
      rubrics: {
        satisfiesRequirements: {
          type: 'noul',
          question: 'Does the code satisfy the functional criteria of the specification?',
        },
      },
      assertions: { satisfiesRequirements: { minProbability: 0.8 } },
    },
  },
};`;

describe('CLI check command', () => {
  const originalApiKey = process.env.TYPESAFE_AI_API_KEY;
  const originalTypesafeKey = process.env.TYPESAFE_API_KEY;
  const tempDirs: string[] = [];

  /** Creates a git-ignored scratch directory inside the project root. */
  const makeProjectTempDir = async (): Promise<string> => {
    const dir = await fs.mkdtemp(path.join(pkgRoot, 'test', '.tmp-cli-'));
    tempDirs.push(dir);
    return dir;
  };

  beforeEach(() => {
    delete process.env.TYPESAFE_AI_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
  });

  after(async () => {
    if (originalApiKey === undefined) {
      delete process.env.TYPESAFE_AI_API_KEY;
    } else {
      process.env.TYPESAFE_AI_API_KEY = originalApiKey;
    }
    if (originalTypesafeKey === undefined) {
      delete process.env.TYPESAFE_API_KEY;
    } else {
      process.env.TYPESAFE_API_KEY = originalTypesafeKey;
    }
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it('returns exit code 2 for missing configuration', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-spec-cli-'));
    tempDirs.push(tempDir);
    const { result } = await captureConsole(() => checkCommand({ cwd: tempDir, format: 'json' }));
    expect(result).toBe(2);
  });

  it('writes json output to a file when --output is set', async () => {
    const tempDir = await makeProjectTempDir();
    const outputPath = path.join(tempDir, 'result.json');
    const exitCode = await checkCommand({
      cwd: pkgRoot,
      config: 'test/fixtures/sample.config.ts',
      format: 'json',
      output: outputPath,
    });

    expect(exitCode).toBe(0);
    const written = await fs.readFile(outputPath, 'utf-8');
    expect(written).toContain('"passed": true');
  });

  it('returns exit code 2 with an API key error when no key is set and mock mode is off', async () => {
    const tempDir = await makeProjectTempDir();
    const configPath = path.join(tempDir, 'jev-spec.config.mjs');
    await fs.writeFile(configPath, LIVE_CONFIG_SOURCE, 'utf-8');

    const { result, stderr } = await captureConsole(() =>
      checkCommand({ cwd: pkgRoot, config: configPath, format: 'json' })
    );

    expect(result).toBe(2);
    expect(stderr).toContain('API key is required');
  });

  it('runs offline with --mock even though the configuration does not enable mock mode', async () => {
    const tempDir = await makeProjectTempDir();
    const configPath = path.join(tempDir, 'jev-spec.config.mjs');
    await fs.writeFile(configPath, LIVE_CONFIG_SOURCE, 'utf-8');

    const { result, stdout } = await captureConsole(() =>
      checkCommand({ cwd: pkgRoot, config: configPath, format: 'json', mock: true })
    );

    expect(result).toBe(0);
    expect((JSON.parse(stdout) as { mock?: boolean }).mock).toBe(true);
  });

  it('accepts --mock on the command line', () => {
    expect(parseCliArgs(['check', '--mock'])).toEqual({ kind: 'check', options: { mock: true } });
  });

  it('rejects an --output path outside the project root before spending an evaluation', async () => {
    const tempDir = await makeProjectTempDir();
    const configPath = path.join(tempDir, 'jev-spec.config.mjs');
    // The spec file does not exist: if verification ran first, the error would be ENOENT.
    await fs.writeFile(
      configPath,
      LIVE_CONFIG_SOURCE.replace('test/fixtures/specs/auth-requirements.md', 'test/fixtures/specs/missing.md'),
      'utf-8'
    );

    const { result, stderr } = await captureConsole(() =>
      checkCommand({
        cwd: pkgRoot,
        config: configPath,
        mock: true,
        format: 'markdown',
        output: path.join(os.tmpdir(), 'jev-spec-step-summary.md'),
      })
    );

    expect(result).toBe(2);
    expect(stderr).toContain('outside project root');
    expect(stderr.includes('ENOENT')).toBe(false);
  });
});
