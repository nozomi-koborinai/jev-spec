import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, describe, test as it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect } from './test-utils.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '../..');
const script = path.join(pkgRoot, 'scripts', 'release-notes.mjs');

const CHANGELOG = `# Changelog

## [Unreleased]

## [1.2.0] - 2026-01-02

A feature release.

### Added

- Feature A.

## [1.1.0] - 2026-01-01

### Fixed

- Bug B.

## [1.0.0] - 2025-12-31

[Unreleased]: https://example.invalid/compare/v1.2.0...HEAD
[1.2.0]: https://example.invalid/compare/v1.1.0...v1.2.0
`;

interface RunResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

describe('scripts/release-notes.mjs', () => {
  const tempDirs: string[] = [];

  after(async () => {
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  /** Runs the script against a throwaway CHANGELOG.md and package.json. */
  const run = async (
    tag: string,
    packageVersion: string,
    changelog = CHANGELOG
  ): Promise<RunResult> => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-spec-release-notes-'));
    tempDirs.push(dir);
    const changelogPath = path.join(dir, 'CHANGELOG.md');
    const packagePath = path.join(dir, 'package.json');
    await fs.writeFile(changelogPath, changelog, 'utf-8');
    await fs.writeFile(
      packagePath,
      JSON.stringify({ name: 'jev-spec', version: packageVersion }),
      'utf-8'
    );

    try {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [script, tag, '--changelog', changelogPath, '--package', packagePath],
        { encoding: 'utf-8' }
      );
      return { code: 0, stdout, stderr };
    } catch (error: unknown) {
      const failure = error as { code?: number; stdout?: string; stderr?: string };
      return {
        code: typeof failure.code === 'number' ? failure.code : -1,
        stdout: failure.stdout ?? '',
        stderr: failure.stderr ?? '',
      };
    }
  };

  it('prints the body of the section for the tagged version and the install line', async () => {
    const result = await run('v1.2.0', '1.2.0');

    expect(result.code).toBe(0);
    expect(result.stdout).toBe(
      [
        'A feature release.',
        '',
        '### Added',
        '',
        '- Feature A.',
        '',
        '---',
        '',
        'Install: `npm install -D jev-spec@1.2.0`',
        '',
      ].join('\n')
    );
  });

  it('stops at the next version heading', async () => {
    const result = await run('v1.1.0', '1.1.0');

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('- Bug B.');
    expect(result.stdout.includes('Feature A')).toBe(false);
    expect(result.stdout.includes('1.0.0')).toBe(false);
  });

  it('fails when the tag and the package version disagree', async () => {
    const result = await run('v1.2.0', '1.1.0');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('1.1.0');
    expect(result.stdout).toBe('');
  });

  it('fails when the changelog has no section for the version', async () => {
    const result = await run('v2.0.0', '2.0.0');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('2.0.0');
    expect(result.stdout).toBe('');
  });

  it('fails when the section is empty, even if link references follow it', async () => {
    const result = await run('v1.0.0', '1.0.0');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('is empty');
    expect(result.stdout).toBe('');
  });

  it('rejects a tag that is not a version tag', async () => {
    const result = await run('release-candidate', '1.2.0');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('"release-candidate" is not a version tag');
    expect(result.stdout).toBe('');
  });

  it('finds a section for the version that package.json currently declares', async () => {
    const pkg = JSON.parse(await fs.readFile(path.join(pkgRoot, 'package.json'), 'utf-8')) as {
      version: string;
    };

    const { stdout } = await execFileAsync(process.execPath, [script, `v${pkg.version}`], {
      cwd: pkgRoot,
      encoding: 'utf-8',
    });

    expect(stdout).toContain(`npm install -D jev-spec@${pkg.version}`);
    expect(stdout.trim().length > 60).toBe(true);
  });
});
