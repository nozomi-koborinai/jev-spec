import * as path from 'node:path';
import { afterEach, describe, test as it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ConfigValidationError, validateConfig } from '../src/config-validation.js';
import { noul } from '../src/dsl.js';
import {
  isModelAlias,
  type JevEvaluator,
  LiveJevEvaluator,
  resolveModel,
} from '../src/evaluator/jev-evaluator.js';
import { runChecks } from '../src/runner/engine.js';
import { formatMarkdownReport, formatTerminalReport } from '../src/runner/reporter.js';
import type { JevSpecConfig } from '../src/types.js';
import { sampleConfig } from './own-project.js';
import { expect } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '../..');

const PASSING_ANSWERS = {
  satisfiesRequirements: { type: 'noul', probability: 0.97 },
  introducesUnspecifiedBehavior: { type: 'noul', probability: 0.02 },
  securityPosture: {
    type: 'choice',
    choice: 'secure',
    confidence: 0.93,
    distribution: { secure: 0.93, insecure: 0.07 },
  },
  implementationCompleteness: {
    type: 'score',
    score: 1.9,
    maxScore: 2,
    confidence: 0.9,
    selectedLevel: 'Feature Complete',
    levelProbabilities: [0.02, 0.06, 0.92],
  },
} as const;

/** The sample targets with a live (non-mock) client section. */
function liveConfig(client: JevSpecConfig['client'] = {}): JevSpecConfig {
  return { client, targets: sampleConfig.targets };
}

describe('model pinning', () => {
  const originalDefaultModel = process.env.TYPESAFE_DEFAULT_MODEL;

  afterEach(() => {
    if (originalDefaultModel === undefined) {
      delete process.env.TYPESAFE_DEFAULT_MODEL;
    } else {
      process.env.TYPESAFE_DEFAULT_MODEL = originalDefaultModel;
    }
  });

  it('resolves the model from the config, then TYPESAFE_DEFAULT_MODEL, then jev-latest', () => {
    delete process.env.TYPESAFE_DEFAULT_MODEL;
    expect(resolveModel()).toBe('jev-latest');
    expect(resolveModel({})).toBe('jev-latest');

    process.env.TYPESAFE_DEFAULT_MODEL = 'jev-1.12.0';
    expect(resolveModel({})).toBe('jev-1.12.0');
    expect(resolveModel({ model: ' jev-1.13.0 ' })).toBe('jev-1.13.0');
  });

  it('tells aliases, which move with releases, from versioned model IDs', () => {
    expect(isModelAlias('jev-latest')).toBe(true);
    expect(isModelAlias('jev-preview')).toBe(true);
    expect(isModelAlias('jev-1.13.0')).toBe(false);
  });

  it('sends the configured model with the request and returns the model that answered', async () => {
    const requests: Array<{ model?: string }> = [];
    const evaluator = new LiveJevEvaluator(
      { apiKey: 'test-key', model: 'jev-1.13.0' },
      {
        async systemOne(request: { model?: string }) {
          requests.push(request);
          return {
            model: 'jev-1.13.0',
            answers: { holds: { type: 'noul', noul: 0.91 } },
            usage: { input_tokens: 10, output_tokens: 0 },
          };
        },
      }
    );

    const output = await evaluator.evaluate({
      specContext: 'REQ-01: tokens are signed',
      codeContext: 'export const signed = true;',
      rubrics: { holds: noul('Does the code satisfy REQ-01: tokens are signed?') },
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].model).toBe('jev-1.13.0');
    expect(output.model).toBe('jev-1.13.0');
    expect(output.answers.holds).toEqual({ type: 'noul', probability: 0.91 });
  });

  it('records the model that answered on the target and prints it in the reports', async () => {
    const evaluator: JevEvaluator = {
      async evaluate() {
        return { answers: PASSING_ANSWERS, model: 'jev-1.13.0' };
      },
    };

    const result = await runChecks(liveConfig(), { cwd: pkgRoot, evaluator });

    expect(result.passed).toBe(true);
    expect(result.targets[0].model).toBe('jev-1.13.0');
    expect(formatTerminalReport(result)).toContain('Model: jev-1.13.0');
    expect(formatMarkdownReport(result)).toContain('`jev-1.13.0`');
  });

  it('warns in a dry run when the model is an alias, because a release can then change a result', async () => {
    delete process.env.TYPESAFE_DEFAULT_MODEL;

    const unpinned = await runChecks(liveConfig(), { cwd: pkgRoot, dryRun: true });
    const alias = await runChecks(liveConfig({ model: 'jev-latest' }), {
      cwd: pkgRoot,
      dryRun: true,
    });

    expect(unpinned.warnings ?? []).toHaveLength(1);
    expect((unpinned.warnings ?? [])[0]).toContain('not pinned');
    expect((unpinned.warnings ?? [])[0]).toContain('jev-latest');
    expect(alias.warnings ?? []).toHaveLength(1);

    const terminal = formatTerminalReport(unpinned);
    expect(terminal).toContain('not pinned');
    expect(terminal).toContain('DRY RUN OK');
    // The summary counts the warning about the setup on top of the warnings of the targets.
    const targetWarnings = unpinned.targets.reduce(
      (count, target) => count + (target.plan?.warnings.length ?? 0),
      0
    );
    expect(terminal).toContain(`${targetWarnings + 1} warning(s)`);
  });

  it('does not warn when the model is pinned in the config or in TYPESAFE_DEFAULT_MODEL, or in mock mode', async () => {
    delete process.env.TYPESAFE_DEFAULT_MODEL;
    const pinned = await runChecks(liveConfig({ model: 'jev-1.13.0' }), {
      cwd: pkgRoot,
      dryRun: true,
    });
    const mock = await runChecks(liveConfig({ mock: true }), { cwd: pkgRoot, dryRun: true });

    process.env.TYPESAFE_DEFAULT_MODEL = 'jev-1.13.0';
    const pinnedByEnv = await runChecks(liveConfig(), { cwd: pkgRoot, dryRun: true });

    expect(pinned.warnings).toBe(undefined);
    expect(mock.warnings).toBe(undefined);
    expect(pinnedByEnv.warnings).toBe(undefined);
  });

  it('rejects a model that is not a non-empty string', () => {
    for (const model of ['', '   ', 5]) {
      const config = {
        client: { model },
        targets: sampleConfig.targets,
      } as unknown as JevSpecConfig;
      try {
        validateConfig(config);
        throw new Error(`expected validateConfig to reject model ${JSON.stringify(model)}`);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect((error as ConfigValidationError).issues).toEqual([
          'client.model: must be a non-empty string such as "jev-1.13.0"',
        ]);
      }
    }
  });
});
