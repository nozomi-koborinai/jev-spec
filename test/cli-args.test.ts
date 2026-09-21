import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, test as it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { CliUsageError, parseCliArgs } from '../src/cli/args.js';
import { main } from '../src/cli/main.js';
import { captureConsole, expect } from './test-utils.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '../..');

describe('CLI argument parsing', () => {
  it('defaults to the check command with no options', () => {
    expect(parseCliArgs([])).toEqual({ kind: 'check', options: {} });
    expect(parseCliArgs(['check'])).toEqual({ kind: 'check', options: {} });
  });

  it('parses value options in both "--name value" and "--name=value" forms', () => {
    expect(
      parseCliArgs([
        'check',
        '--target',
        'auth',
        '-f',
        'json',
        '--output=out/result.json',
        '-c',
        'my.config.ts',
      ])
    ).toEqual({
      kind: 'check',
      options: {
        target: 'auth',
        format: 'json',
        output: 'out/result.json',
        config: 'my.config.ts',
      },
    });
  });

  it('treats --diff without a value as a bare diff and keeps parsing the next option', () => {
    expect(parseCliArgs(['check', '--diff', '--format', 'markdown'])).toEqual({
      kind: 'check',
      options: { diff: true, format: 'markdown' },
    });
    expect(parseCliArgs(['check', '--diff', 'origin/main...HEAD'])).toEqual({
      kind: 'check',
      options: { diff: 'origin/main...HEAD' },
    });
  });

  it('recognises --help and --version anywhere on the command line', () => {
    expect(parseCliArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseCliArgs(['check', '--target', 'auth', '-h'])).toEqual({ kind: 'help' });
    expect(parseCliArgs(['--version'])).toEqual({ kind: 'version' });
    expect(parseCliArgs(['-v'])).toEqual({ kind: 'version' });
  });

  it('rejects unknown options instead of silently ignoring them', () => {
    assert.throws(() => parseCliArgs(['check', '--stagd']), CliUsageError);
  });

  it('rejects unknown commands', () => {
    assert.throws(() => parseCliArgs(['verify']), CliUsageError);
  });

  it('rejects an unsupported --format value', () => {
    assert.throws(() => parseCliArgs(['check', '--format', 'xml']), CliUsageError);
  });

  it('rejects value options that are missing their value', () => {
    assert.throws(() => parseCliArgs(['check', '--target']), CliUsageError);
    assert.throws(() => parseCliArgs(['check', '--target', '--staged']), CliUsageError);
    assert.throws(() => parseCliArgs(['check', '--output=']), CliUsageError);
  });

  it('rejects --staged combined with --diff', () => {
    assert.throws(() => parseCliArgs(['check', '--staged', '--diff', 'HEAD~1']), CliUsageError);
  });
});

describe('CLI entry point', () => {
  it('prints usage and exits 0 for --help without needing a configuration file', async () => {
    const { result, stdout } = await captureConsole(() => main(['--help']));

    expect(result).toBe(0);
    expect(stdout).toContain('jev-spec check');
    expect(stdout).toContain('--staged');
  });

  it('prints the package version and exits 0 for --version', async () => {
    const pkg = JSON.parse(await fs.readFile(path.join(pkgRoot, 'package.json'), 'utf-8')) as {
      version: string;
    };

    const { result, stdout } = await captureConsole(() => main(['--version']));

    expect(result).toBe(0);
    expect(stdout.trim()).toBe(pkg.version);
  });

  it('exits 2 and explains the problem for an unknown option', async () => {
    const { result, stderr } = await captureConsole(() => main(['check', '--stagd']));

    expect(result).toBe(2);
    expect(stderr).toContain('--stagd');
  });
});

describe('bin/jev-spec.js', () => {
  it('serves --help from a directory that has no configuration file', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-spec-bin-'));
    try {
      const { stdout } = await execFileAsync(
        process.execPath,
        [path.join(pkgRoot, 'bin', 'jev-spec.js'), '--help'],
        { cwd: emptyDir, encoding: 'utf-8' }
      );
      expect(stdout).toContain('jev-spec check');
    } finally {
      await fs.rm(emptyDir, { recursive: true, force: true });
    }
  });
});
