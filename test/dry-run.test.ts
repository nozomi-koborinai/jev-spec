import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, beforeEach, describe, test as it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CliUsageError, parseCliArgs } from '../src/cli/args.js';
import { checkCommand } from '../src/cli/commands/check.js';
import { extractCodeContext } from '../src/context/code-extractor.js';
import type { JevEvaluator } from '../src/evaluator/jev-evaluator.js';
import { SpecFilterError } from '../src/parser/markdown-parser.js';
import { runChecks } from '../src/runner/engine.js';
import { formatMarkdownReport, formatTerminalReport } from '../src/runner/reporter.js';
import type { JevSpecConfig, OverallCheckResult } from '../src/types.js';
import { captureConsole, expect } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '../..');

/** No `client.mock` and no API key: a real run of this config cannot even start. */
const liveConfig: JevSpecConfig = {
  targets: {
    auth: {
      specPath: 'test/fixtures/specs/auth-requirements.md',
      codePaths: ['test/fixtures/src/**/*.ts', '!**/*.test.ts'],
      rubrics: {
        verifiesSessionTokens: {
          type: 'noul',
          question: 'Does the code satisfy REQ-AUTH-01: session tokens are verified?',
        },
        rejectsRevokedTokens: {
          type: 'noul',
          question: 'Does the code satisfy REQ-AUTH-02: revoked tokens are rejected?',
        },
      },
      assertions: {
        verifiesSessionTokens: { minProbability: 0.85 },
        rejectsRevokedTokens: { minProbability: 0.85 },
      },
    },
  },
};

const explodingEvaluator: JevEvaluator = {
  async evaluate() {
    throw new Error('the evaluator must not be called in a dry run');
  },
};

describe('dry run', () => {
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

  it('needs no API key and reports what each target would send', async () => {
    const result = await runChecks(liveConfig, { cwd: pkgRoot, dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.passed).toBe(true);

    const target = result.targets[0];
    expect(target.codeFiles).toEqual(['test/fixtures/src/auth.ts']);
    expect(target.evaluations).toHaveLength(0);
    expect(target.plan?.requirementIds).toEqual(['REQ-AUTH-01', 'REQ-AUTH-02']);
    expect(target.plan?.rubrics).toEqual(['verifiesSessionTokens', 'rejectsRevokedTokens']);
    expect(target.plan?.warnings).toEqual([]);
    assert.ok((target.plan?.specChars ?? 0) > 0, 'specChars should be reported');
    assert.ok((target.plan?.codeChars ?? 0) > 0, 'codeChars should be reported');
  });

  it('lists the requirements that no rubric names', async () => {
    const partial: JevSpecConfig = {
      targets: {
        auth: {
          ...liveConfig.targets.auth,
          rubrics: { verifiesSessionTokens: liveConfig.targets.auth.rubrics.verifiesSessionTokens },
          assertions: { verifiesSessionTokens: { minProbability: 0.85 } },
        },
      },
    };

    const covered = await runChecks(liveConfig, { cwd: pkgRoot, dryRun: true });
    const result = await runChecks(partial, { cwd: pkgRoot, dryRun: true });

    expect(covered.targets[0].plan?.unreferencedRequirementIds).toEqual([]);
    expect(result.targets[0].plan?.unreferencedRequirementIds).toEqual(['REQ-AUTH-02']);
    expect(result.targets[0].plan?.warnings).toHaveLength(1);
    expect(formatTerminalReport(result)).toContain('REQ-AUTH-02');
  });

  it('does not mistake REQ-AUTH-1 for REQ-AUTH-10 when matching requirement IDs', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-spec-dry-run-ids-'));
    try {
      await fs.mkdir(path.join(dir, 'src'));
      await fs.writeFile(path.join(dir, 'src', 'a.ts'), 'export const a = 1;\n', 'utf-8');
      await fs.writeFile(
        path.join(dir, 'spec.md'),
        '# Spec\n\n## REQ-AUTH-1\nFirst.\n\n## REQ-AUTH-10\nTenth.\n',
        'utf-8'
      );
      const config: JevSpecConfig = {
        targets: {
          auth: {
            specPath: 'spec.md',
            codePaths: ['src/**/*.ts'],
            rubrics: {
              tenth: { type: 'noul', question: 'Does the code satisfy REQ-AUTH-10: tenth?' },
            },
            assertions: { tenth: { minProbability: 0.85 } },
          },
        },
      };

      const result = await runChecks(config, { cwd: dir, dryRun: true });

      expect(result.targets[0].plan?.unreferencedRequirementIds).toEqual(['REQ-AUTH-1']);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('never calls the evaluator', async () => {
    const result = await runChecks(liveConfig, {
      cwd: pkgRoot,
      dryRun: true,
      evaluator: explodingEvaluator,
    });

    expect(result.dryRun).toBe(true);
  });

  it('still fails on a broken setup, such as a specFilter that matches nothing', async () => {
    const broken: JevSpecConfig = {
      targets: {
        auth: { ...liveConfig.targets.auth, specFilter: { requirementPrefix: 'REQ-AUHT-' } },
      },
    };

    await assert.rejects(() => runChecks(broken, { cwd: pkgRoot, dryRun: true }), SpecFilterError);
  });

  it('warns when the codePaths of a target match no file', async () => {
    const empty: JevSpecConfig = {
      targets: {
        auth: { ...liveConfig.targets.auth, codePaths: ['test/fixtures/nowhere/**/*.ts'] },
      },
    };

    const result = await runChecks(empty, { cwd: pkgRoot, dryRun: true });

    expect(result.passed).toBe(true);
    expect(result.targets[0].plan?.warnings).toHaveLength(1);
    expect(result.targets[0].plan?.warnings[0]).toContain('matched no file');
  });

  it('flags a code context that was cut at the character budget', async () => {
    const full = await extractCodeContext(['test/fixtures/src/**/*.ts'], { cwd: pkgRoot });
    const cut = await extractCodeContext(['test/fixtures/src/**/*.ts'], {
      cwd: pkgRoot,
      maxTotalChars: 40,
    });

    expect(full.truncated).toBe(false);
    expect(cut.truncated).toBe(true);
  });

  it('labels the reports as a dry run and never claims that checks passed', async () => {
    const result = await runChecks(liveConfig, { cwd: pkgRoot, dryRun: true });

    const terminal = formatTerminalReport(result);
    expect(terminal).toContain('DRY RUN');
    expect(terminal).toContain('REQ-AUTH-01');
    expect(terminal).toContain('test/fixtures/src/auth.ts');
    expect(terminal.includes('ALL CHECKS PASSED')).toBe(false);

    const markdown = formatMarkdownReport(result);
    expect(markdown).toContain('DRY RUN');
    expect(markdown.includes('✅ PASS')).toBe(false);
  });

  it('shows plan warnings in the terminal report', () => {
    const result: OverallCheckResult = {
      dryRun: true,
      passed: true,
      totalDurationMs: 1,
      totalEstimatedCostUsd: 0,
      targets: [
        {
          targetName: 'auth',
          specFiles: ['spec.md'],
          codeFiles: [],
          passed: true,
          evaluations: [],
          durationMs: 1,
          estimatedCostUsd: 0,
          plan: {
            specSections: ['REQ-AUTH-01'],
            requirementIds: ['REQ-AUTH-01'],
            specChars: 10,
            codeChars: 0,
            rubrics: ['verifiesSessionTokens'],
            unreferencedRequirementIds: [],
            warnings: ['codePaths matched no file'],
          },
        },
      ],
    };

    expect(formatTerminalReport(result)).toContain('codePaths matched no file');
  });
});

describe('dry run from the command line', () => {
  const tempDirs: string[] = [];

  after(async () => {
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it('parses --dry-run', () => {
    expect(parseCliArgs(['check', '--dry-run'])).toEqual({
      kind: 'check',
      options: { dryRun: true },
    });
  });

  it('rejects --dry-run combined with --mock', () => {
    assert.throws(() => parseCliArgs(['check', '--dry-run', '--mock']), CliUsageError);
  });

  it('exits 0 without an API key and prints the plan', async () => {
    delete process.env.TYPESAFE_AI_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    const dir = await fs.mkdtemp(path.join(pkgRoot, 'test', '.tmp-dry-run-'));
    tempDirs.push(dir);
    const configPath = path.join(dir, 'jev-spec.config.mjs');
    await fs.writeFile(configPath, `export default ${JSON.stringify(liveConfig)};`, 'utf-8');

    const { result, stdout } = await captureConsole(() =>
      checkCommand({ cwd: pkgRoot, config: configPath, dryRun: true, format: 'json' })
    );

    expect(result).toBe(0);
    const report = JSON.parse(stdout) as OverallCheckResult;
    expect(report.dryRun).toBe(true);
    expect(report.targets[0].plan?.requirementIds).toEqual(['REQ-AUTH-01', 'REQ-AUTH-02']);
  });

  it('exits 2 when the setup is broken', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-spec-dry-run-'));
    tempDirs.push(dir);

    const { result } = await captureConsole(() => checkCommand({ cwd: dir, dryRun: true }));

    expect(result).toBe(2);
  });
});
