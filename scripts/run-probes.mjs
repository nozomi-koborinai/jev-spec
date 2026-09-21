#!/usr/bin/env node
// Shows that the rubrics of jev-spec.config.ts can fail: for every requirement, the check runs
// on the intact sources and on a copy in which test/probes/<ID>.patch has broken that one
// requirement. A rubric earns its place in the gate when it passes the first and fails the second.
//
//   npm run build
//   node scripts/run-probes.mjs [--only REQ-EXIT-02]... [--out docs/probe-results.md] [--mock]
//
// A real run needs TYPESAFE_AI_API_KEY. `--mock` exercises the plumbing only: the mock
// evaluator does not read the code, so its answers say nothing about the probes.

import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'bin', 'jev-spec.js');
const probesDir = path.join(repoRoot, 'test', 'probes');
const REQUIREMENT_ID = /REQ-[A-Z]+-\d{2}/;

class ProbeError extends Error {}

function parseArgs(argv) {
  const options = { only: [], out: undefined, mock: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--mock') {
      options.mock = true;
    } else if (arg === '--only' || arg === '--out') {
      const value = argv[++i];
      if (value === undefined) {
        throw new ProbeError(`Option "${arg}" requires a value`);
      }
      if (arg === '--only') {
        options.only.push(value);
      } else {
        options.out = value;
      }
    } else {
      throw new ProbeError(`Unknown argument "${arg}"`);
    }
  }
  return options;
}

/** Runs the built CLI and returns its JSON report. Exit codes 0 and 1 both carry a report. */
async function runCheck(cwd, { target, mock }) {
  const args = [cli, 'check', '--format', 'json'];
  if (target) {
    args.push('--target', target);
  }
  if (mock) {
    args.push('--mock');
  }
  try {
    const { stdout } = await execFileAsync(process.execPath, args, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 32 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (error) {
    if (error.code === 1 && error.stdout) {
      return JSON.parse(error.stdout);
    }
    throw new ProbeError(
      `jev-spec check failed in ${cwd}: ${(error.stderr || error.message).trim()}`
    );
  }
}

/** Requirement ID -> the rubric that names it, with its answer in this report. */
function answersByRequirement(report) {
  const byRequirement = new Map();
  for (const target of report.targets) {
    for (const evaluation of target.evaluations) {
      const text = evaluation.rubric.question ?? evaluation.rubric.description ?? '';
      const id = REQUIREMENT_ID.exec(text)?.[0];
      if (id) {
        byRequirement.set(id, {
          target: target.targetName,
          rubric: evaluation.rubricName,
          passed: evaluation.passed,
          answer: describeAnswer(evaluation.result),
          model: target.model,
        });
      }
    }
  }
  return byRequirement;
}

function describeAnswer(result) {
  if (result.type === 'noul') {
    return result.probability.toFixed(2);
  }
  if (result.type === 'choice') {
    return `${result.choice} (${result.confidence.toFixed(2)})`;
  }
  return `${result.score.toFixed(2)} / ${result.maxScore}`;
}

/** Copies the tracked files of the working tree, so that probing never touches the repository. */
async function copyTrackedFiles(destination) {
  const { stdout } = await execFileAsync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
  });
  for (const file of stdout.split('\0').filter(Boolean)) {
    const from = path.join(repoRoot, file);
    const to = path.join(destination, file);
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(from, to).catch((error) => {
      // A tracked file that was deleted in the working tree is simply absent from the copy.
      if (error.code !== 'ENOENT') {
        throw error;
      }
    });
  }
}

function verdict(intact, broken) {
  if (!intact) {
    return 'no rubric';
  }
  if (!intact.passed) {
    return 'FAILS INTACT';
  }
  if (!broken) {
    return 'no answer';
  }
  return broken.passed ? 'MISSED' : 'caught';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  await fs.access(path.join(repoRoot, 'dist', 'cli', 'main.js')).catch(() => {
    throw new ProbeError('dist/ is missing: run "npm run build" first');
  });

  const patches = (await fs.readdir(probesDir))
    .filter((name) => name.endsWith('.patch'))
    .map((name) => name.slice(0, -'.patch'.length))
    .filter((id) => options.only.length === 0 || options.only.includes(id))
    .sort();
  if (patches.length === 0) {
    throw new ProbeError('No probe matches');
  }

  const intactReport = await runCheck(repoRoot, { mock: options.mock });
  const intact = answersByRequirement(intactReport);

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-spec-probes-'));
  const rows = [];
  try {
    await copyTrackedFiles(workDir);

    for (const id of patches) {
      const patch = path.join(probesDir, `${id}.patch`);
      const before = intact.get(id);
      let broken;
      if (before) {
        await execFileAsync('git', ['apply', patch], { cwd: workDir });
        try {
          const report = await runCheck(workDir, { target: before.target, mock: options.mock });
          broken = answersByRequirement(report).get(id);
        } finally {
          await execFileAsync('git', ['apply', '-R', patch], { cwd: workDir });
        }
      }
      rows.push({ id, before, broken, verdict: verdict(before, broken) });
      console.error(`${id}: ${rows.at(-1).verdict}`);
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }

  const { stdout: commit } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf-8',
  });
  const manifest = JSON.parse(await fs.readFile(path.join(repoRoot, 'package.json'), 'utf-8'));
  const models = [...new Set([...intact.values()].map((entry) => entry.model).filter(Boolean))];
  const caught = rows.filter((row) => row.verdict === 'caught').length;

  const lines = [
    '# Probe results',
    '',
    options.mock
      ? '**Mock run: this exercises the plumbing only. The mock evaluator does not read the code, so nothing below says anything about the rubrics.**'
      : 'Every requirement was checked twice: on the intact sources, and on a copy in which `test/probes/<ID>.patch` breaks that one requirement. A rubric belongs in the gate when it passes the first and fails the second.',
    '',
    `- Date: ${new Date().toISOString().slice(0, 10)}`,
    `- Model: ${models.length > 0 ? models.join(', ') : 'none (mock)'}`,
    `- jev-spec: ${manifest.version} at ${commit.trim()}`,
    `- Caught: ${caught} of ${rows.length}`,
    '',
    '| Requirement | Target | Rubric | Intact | Broken | Result |',
    '| :--- | :--- | :--- | :--- | :--- | :--- |',
    ...rows.map(
      (row) =>
        `| ${row.id} | ${row.before?.target ?? '–'} | ${row.before?.rubric ?? '–'} | ${row.before?.answer ?? '–'} | ${row.broken?.answer ?? '–'} | ${row.verdict} |`
    ),
    '',
  ];
  const markdown = lines.join('\n');

  if (options.out) {
    await fs.writeFile(path.resolve(repoRoot, options.out), markdown, 'utf-8');
  } else {
    process.stdout.write(markdown);
  }

  // A mock run proves the plumbing, not the rubrics, so only a real run can fail.
  process.exitCode = options.mock || caught === rows.length ? 0 : 1;
}

try {
  await main();
} catch (error) {
  if (error instanceof ProbeError) {
    console.error(`[run-probes] ${error.message}`);
    process.exit(2);
  }
  throw error;
}
