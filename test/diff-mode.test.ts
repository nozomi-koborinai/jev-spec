import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test as it } from 'node:test';
import {
  type EvaluationInput,
  type JevEvaluator,
  JevSpecConfigurationError,
} from '../src/evaluator/jev-evaluator.js';
import { runVerification } from '../src/runner/engine.js';
import { formatMarkdownReport, formatTerminalReport } from '../src/runner/reporter.js';
import type { AnyRubricResult, JevSpecConfig } from '../src/types.js';
import { createTempGitRepo, type TempGitRepo } from './git-test-utils.js';
import { expect } from './test-utils.js';

class RecordingEvaluator implements JevEvaluator {
  readonly calls: EvaluationInput[] = [];

  async evaluate(input: EvaluationInput): Promise<Record<string, AnyRubricResult>> {
    this.calls.push(input);
    return { satisfies: { type: 'noul', probability: 0.95 } };
  }
}

const config: JevSpecConfig = {
  zones: {
    core: {
      specPath: 'docs/spec.md',
      codePaths: ['src/**/*.ts'],
      rubrics: { satisfies: { type: 'noul', question: 'Does the code satisfy REQ-A-01?' } },
      assertions: { satisfies: { minProbability: 0.8 } },
    },
  },
};

describe('diff mode zone selection', () => {
  let repo: TempGitRepo;
  let evaluator: RecordingEvaluator;

  before(async () => {
    repo = await createTempGitRepo('jev-spec-diff-mode-');
    await repo.write('docs/spec.md', '# Spec\n\n## REQ-A-01\nThe module MUST export `a`.\n');
    await repo.write('src/a.ts', 'export const a = 1;\n');
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

  it('skips a zone without calling the evaluator when no staged file matches its codePaths', async () => {
    await repo.write('NOTES.md', 'unrelated change\n');
    repo.git('add', 'NOTES.md');

    const result = await runVerification(config, {
      cwd: repo.dir,
      evaluator,
      gitDiff: { staged: true },
    });

    expect(evaluator.calls).toHaveLength(0);
    expect(result.zones[0].skipped).toBe(true);
    expect(result.zones[0].evaluations).toHaveLength(0);
    expect(result.passed).toBe(true);
  });

  it('evaluates a zone against the staged hunks when a matching file changed', async () => {
    await repo.write('src/a.ts', 'export const a = 1;\nexport const b = 2;\n');
    repo.git('add', 'src/a.ts');

    const result = await runVerification(config, {
      cwd: repo.dir,
      evaluator,
      gitDiff: { staged: true },
    });

    expect(evaluator.calls).toHaveLength(1);
    expect(evaluator.calls[0].codeContext).toContain('+export const b = 2;');
    expect(result.zones[0].skipped).toBe(undefined);
    expect(result.zones[0].codeFiles).toEqual(['src/a.ts']);
  });

  it('labels skipped zones in terminal and markdown reports', async () => {
    await repo.write('NOTES.md', 'unrelated change\n');
    repo.git('add', 'NOTES.md');

    const result = await runVerification(config, {
      cwd: repo.dir,
      evaluator,
      gitDiff: { staged: true },
    });

    expect(formatTerminalReport(result)).toContain('SKIPPED');
    expect(formatMarkdownReport(result)).toContain('SKIPPED');
  });

  it('does not let a broken spec in an untouched zone abort the run', async () => {
    await repo.write('NOTES.md', 'unrelated change\n');
    repo.git('add', 'NOTES.md');

    const configWithBrokenZone: JevSpecConfig = {
      zones: {
        core: config.zones.core,
        missingSpec: { ...config.zones.core, specPath: 'docs/does-not-exist.md' },
        typoFilter: { ...config.zones.core, specFilter: { requirementPrefix: 'REQ-TYPO-' } },
      },
    };

    const result = await runVerification(configWithBrokenZone, {
      cwd: repo.dir,
      evaluator,
      gitDiff: { staged: true },
    });

    expect(result.zones.map((zone) => zone.skipped)).toEqual([true, true, true]);
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

    it('passes when every zone is skipped, because no evaluation is needed', async () => {
      await repo.write('NOTES.md', 'unrelated change\n');
      repo.git('add', 'NOTES.md');

      const result = await runVerification(config, { cwd: repo.dir, gitDiff: { staged: true } });

      expect(result.zones[0].skipped).toBe(true);
      expect(result.passed).toBe(true);
    });

    it('still reports the missing key as soon as one zone has matching changes', async () => {
      await repo.write('src/a.ts', 'export const a = 1;\nexport const b = 2;\n');
      repo.git('add', 'src/a.ts');

      await assert.rejects(
        () => runVerification(config, { cwd: repo.dir, gitDiff: { staged: true } }),
        JevSpecConfigurationError
      );
    });
  });
});
