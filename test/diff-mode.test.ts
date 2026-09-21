import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test as it } from 'node:test';
import {
  type EvaluationInput,
  type EvaluationOutput,
  type JevEvaluator,
  JevSpecConfigurationError,
} from '../src/evaluator/jev-evaluator.js';
import { runChecks } from '../src/runner/engine.js';
import { formatMarkdownReport, formatTerminalReport } from '../src/runner/reporter.js';
import type { JevSpecConfig } from '../src/types.js';
import { createTempGitRepo, type TempGitRepo } from './git-test-utils.js';
import { expect } from './test-utils.js';

class RecordingEvaluator implements JevEvaluator {
  readonly calls: EvaluationInput[] = [];

  async evaluate(input: EvaluationInput): Promise<EvaluationOutput> {
    this.calls.push(input);
    return { answers: { satisfies: { type: 'noul', probability: 0.95 } } };
  }
}

const config: JevSpecConfig = {
  targets: {
    core: {
      specPath: 'docs/spec.md',
      codePaths: ['src/**/*.ts'],
      rubrics: { satisfies: { type: 'noul', question: 'Does the code satisfy REQ-A-01?' } },
      assertions: { satisfies: { minProbability: 0.8 } },
    },
  },
};

describe('diff mode target selection', () => {
  let repo: TempGitRepo;
  let evaluator: RecordingEvaluator;

  before(async () => {
    repo = await createTempGitRepo('jev-spec-diff-mode-');
    await repo.write('docs/spec.md', '# Spec\n\n## REQ-A-01\nThe module MUST export `a`.\n');
    await repo.write('src/a.ts', 'export const a = 1;\n');
    await repo.write('src/b.ts', 'export const untouched = true;\n');
    repo.git('add', '-A');
    repo.git('commit', '--quiet', '-m', 'init');
  });

  beforeEach(() => {
    evaluator = new RecordingEvaluator();
    repo.git('reset', '--quiet', '--hard', 'HEAD');
  });

  after(async () => {
    await repo.cleanup();
  });

  it('REQ-DIFF-01: skips a target without calling the evaluator when no staged file matches its codePaths', async () => {
    await repo.write('NOTES.md', 'unrelated change\n');
    repo.git('add', 'NOTES.md');

    const result = await runChecks(config, {
      cwd: repo.dir,
      evaluator,
      gitDiff: { staged: true },
    });

    expect(evaluator.calls).toHaveLength(0);
    expect(result.targets[0].skipped).toBe(true);
    expect(result.targets[0].evaluations).toHaveLength(0);
    expect(result.passed).toBe(true);
  });

  it('REQ-READ-01: checks a touched target on all its files in full, not on the changed hunks', async () => {
    await repo.write('src/a.ts', 'export const a = 1;\nexport const b = 2;\n');
    repo.git('add', 'src/a.ts');

    const result = await runChecks(config, {
      cwd: repo.dir,
      evaluator,
      gitDiff: { staged: true },
    });

    expect(evaluator.calls).toHaveLength(1);
    const sent = evaluator.calls[0].codeContext;
    // The whole changed file and the file that did not change: a rubric asks about the target,
    // and what it asks about is usually outside the hunk.
    expect(sent).toContain('export const a = 1;\nexport const b = 2;');
    expect(sent).toContain('export const untouched = true;');
    expect(sent.includes('@@')).toBe(false);
    expect(sent.includes('+export const b = 2;')).toBe(false);
    expect(result.targets[0].skipped).toBe(undefined);
    expect([...result.targets[0].codeFiles].sort()).toEqual(['src/a.ts', 'src/b.ts']);
    expect(result.targets[0].changedFiles).toEqual(['src/a.ts']);
    expect(formatTerminalReport(result)).toContain('Changed files: src/a.ts');
  });

  it('selects a target when one of its files was deleted', async () => {
    repo.git('rm', '--quiet', 'src/b.ts');

    const result = await runChecks(config, {
      cwd: repo.dir,
      evaluator,
      gitDiff: { staged: true },
    });

    expect(evaluator.calls).toHaveLength(1);
    expect(evaluator.calls[0].codeContext).toContain('export const a = 1;');
    expect(result.targets[0].codeFiles).toEqual(['src/a.ts']);
    expect(result.targets[0].changedFiles).toEqual(['src/b.ts']);
  });

  it('REQ-DIFF-02: checks a target whose code files were all deleted instead of skipping it', async () => {
    repo.git('rm', '--quiet', 'src/a.ts', 'src/b.ts');

    const result = await runChecks(config, {
      cwd: repo.dir,
      evaluator,
      gitDiff: { staged: true },
    });

    // The implementation is gone: that is a change of the target, and the most drastic one.
    expect(evaluator.calls).toHaveLength(1);
    expect(result.targets[0].skipped).toBe(undefined);
    expect(result.targets[0].codeFiles).toEqual([]);
    expect([...(result.targets[0].changedFiles ?? [])].sort()).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('REQ-READ-02: judges the staged content, not the working tree, in a staged run', async () => {
    await repo.write('src/a.ts', 'export const a = 1;\nexport const staged = true;\n');
    repo.git('add', 'src/a.ts');
    // Edited again after staging, as after `git add -p`: this is not what gets committed.
    await repo.write('src/a.ts', 'export const a = 1;\nexport const unstaged = true;\n');
    await repo.write('src/new.ts', 'export const notStagedAtAll = true;\n');

    await runChecks(config, { cwd: repo.dir, evaluator, gitDiff: { staged: true } });

    expect(evaluator.calls).toHaveLength(1);
    const sent = evaluator.calls[0].codeContext;
    expect(sent).toContain('export const staged = true;');
    expect(sent).toContain('export const untouched = true;');
    expect(sent.includes('unstaged')).toBe(false);
    expect(sent.includes('notStagedAtAll')).toBe(false);
  });

  it('shows in a diff dry run which changed files selected a target', async () => {
    await repo.write('src/a.ts', 'export const a = 1;\nexport const b = 2;\n');
    repo.git('add', 'src/a.ts');

    const result = await runChecks(config, {
      cwd: repo.dir,
      dryRun: true,
      gitDiff: { staged: true },
    });

    expect(result.targets[0].changedFiles).toEqual(['src/a.ts']);
    expect(formatTerminalReport(result)).toContain('Changed files: src/a.ts');
  });

  it('labels skipped targets in terminal and markdown reports', async () => {
    await repo.write('NOTES.md', 'unrelated change\n');
    repo.git('add', 'NOTES.md');

    const result = await runChecks(config, {
      cwd: repo.dir,
      evaluator,
      gitDiff: { staged: true },
    });

    expect(formatTerminalReport(result)).toContain('SKIPPED');
    expect(formatMarkdownReport(result)).toContain('SKIPPED');
  });

  it('does not let a broken spec in an untouched target abort the run', async () => {
    await repo.write('NOTES.md', 'unrelated change\n');
    repo.git('add', 'NOTES.md');

    const configWithBrokenTarget: JevSpecConfig = {
      targets: {
        core: config.targets.core,
        missingSpec: { ...config.targets.core, specPath: 'docs/does-not-exist.md' },
        typoFilter: { ...config.targets.core, specFilter: { requirementPrefix: 'REQ-TYPO-' } },
      },
    };

    const result = await runChecks(configWithBrokenTarget, {
      cwd: repo.dir,
      evaluator,
      gitDiff: { staged: true },
    });

    expect(result.targets.map((target) => target.skipped)).toEqual([true, true, true]);
    expect(result.passed).toBe(true);
  });

  describe('without an API key', () => {
    const savedKeys = {
      TYPESAFE_AI_API_KEY: process.env.TYPESAFE_AI_API_KEY,
      TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY,
    };

    beforeEach(() => {
      delete process.env.TYPESAFE_AI_API_KEY;
      delete process.env.TYPESAFE_API_KEY;
    });

    after(() => {
      for (const [name, value] of Object.entries(savedKeys)) {
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      }
    });

    it('passes when every target is skipped, because no evaluation is needed', async () => {
      await repo.write('NOTES.md', 'unrelated change\n');
      repo.git('add', 'NOTES.md');

      const result = await runChecks(config, { cwd: repo.dir, gitDiff: { staged: true } });

      expect(result.targets[0].skipped).toBe(true);
      expect(result.passed).toBe(true);
    });

    it('still reports the missing key as soon as one target has matching changes', async () => {
      await repo.write('src/a.ts', 'export const a = 1;\nexport const b = 2;\n');
      repo.git('add', 'src/a.ts');

      await assert.rejects(
        () => runChecks(config, { cwd: repo.dir, gitDiff: { staged: true } }),
        JevSpecConfigurationError
      );
    });
  });
});
