import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { describe, test as it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { loadConfig } from '../src/config.js';
import type { AnyRubric } from '../src/types.js';
import { expect } from './test-utils.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '../..');
const probesDir = path.join(pkgRoot, 'test', 'probes');
const REQUIREMENT_ID = /REQ-[A-Z]+-\d{2}/;

function rubricText(rubric: AnyRubric): string {
  return rubric.type === 'noul' ? rubric.question : rubric.description;
}

/** Requirement ID -> the code paths of the target whose rubric names it. */
async function codePathsByRequirement(): Promise<Map<string, readonly string[]>> {
  const config = await loadConfig(undefined, pkgRoot);
  const byRequirement = new Map<string, readonly string[]>();
  for (const target of Object.values(config.targets)) {
    for (const rubric of Object.values(target.rubrics)) {
      const id = REQUIREMENT_ID.exec(rubricText(rubric))?.[0];
      if (id) {
        byRequirement.set(id, target.codePaths);
      }
    }
  }
  return byRequirement;
}

async function probeIds(): Promise<string[]> {
  return (await fs.readdir(probesDir))
    .filter((name) => name.endsWith('.patch'))
    .map((name) => name.slice(0, -'.patch'.length))
    .sort();
}

/**
 * A probe is a patch that breaks one requirement on purpose; `scripts/run-probes.mjs` uses it to
 * show that the rubric of that requirement can fail. Whether the model catches a probe needs an
 * API key. What can rot without one is checked here.
 */
describe('probes', () => {
  it('has exactly one probe for every requirement that a rubric names', async () => {
    const requirements = [...(await codePathsByRequirement()).keys()].sort();

    expect(requirements.length > 0).toBe(true);
    expect(await probeIds()).toEqual(requirements);
  });

  it('applies every probe cleanly to the current sources', async () => {
    const stale: string[] = [];
    for (const id of await probeIds()) {
      await execFileAsync('git', ['apply', '--check', path.join(probesDir, `${id}.patch`)], {
        cwd: pkgRoot,
      }).catch(() => stale.push(id));
    }

    expect(stale).toEqual([]);
  });

  it('breaks only code that the target of the requirement sends to the model', async () => {
    const codePaths = await codePathsByRequirement();
    const outside: string[] = [];

    for (const id of await probeIds()) {
      const patch = await fs.readFile(path.join(probesDir, `${id}.patch`), 'utf-8');
      const touched = [...patch.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((match) => match[1]);
      expect(touched.length > 0).toBe(true);
      for (const file of touched) {
        if (!(codePaths.get(id) ?? []).includes(file)) {
          outside.push(`${id}: ${file}`);
        }
      }
    }

    expect(outside).toEqual([]);
  });

  it('runs a probe end to end with the mock evaluator without touching the repository', async () => {
    const [id] = await probeIds();
    const before = await execFileAsync('git', ['status', '--porcelain'], { cwd: pkgRoot });

    const { stdout } = await execFileAsync(
      process.execPath,
      [path.join(pkgRoot, 'scripts', 'run-probes.mjs'), '--mock', '--only', id],
      { cwd: pkgRoot, encoding: 'utf-8' }
    );

    const after = await execFileAsync('git', ['status', '--porcelain'], { cwd: pkgRoot });
    expect(stdout).toContain('Mock run');
    expect(stdout).toContain(`| ${id} |`);
    expect(after.stdout).toBe(before.stdout);
  });
});
