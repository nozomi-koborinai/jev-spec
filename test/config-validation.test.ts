import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, test as it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ConfigValidationError, validateConfig } from '../src/config-validation.js';
import { choice, noul, score } from '../src/dsl.js';
import type { EvaluationInput, JevEvaluator } from '../src/evaluator/jev-evaluator.js';
import { runVerification } from '../src/runner/engine.js';
import type { AnyRubricResult, JevSpecConfig, ZoneConfig } from '../src/types.js';
import sampleConfig from './fixtures/sample.config.js';
import { expect } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '../..');

const baseZone = {
  specPath: 'test/fixtures/specs/auth-requirements.md',
  codePaths: ['test/fixtures/src/auth.ts'],
  rubrics: {
    satisfiesRequirements: noul('Does the code satisfy the requirements?'),
    securityPosture: choice('Security posture', { secure: 'ok', insecure: 'not ok' }),
    completeness: score('Completeness', ['Stub', 'Partial', 'Complete']),
  },
  assertions: {},
};

/** Builds a single-zone config; loosely typed on purpose to model hand-written JS configs. */
function configWith(zoneOverrides: Record<string, unknown>): JevSpecConfig {
  return { zones: { auth: { ...baseZone, ...zoneOverrides } as unknown as ZoneConfig } };
}

function issuesOf(config: JevSpecConfig): readonly string[] {
  try {
    validateConfig(config);
  } catch (error: unknown) {
    assert.ok(error instanceof ConfigValidationError, `unexpected error: ${String(error)}`);
    return error.issues;
  }
  return [];
}

describe('validateConfig', () => {
  it('accepts the sample configuration', () => {
    expect(issuesOf(sampleConfig)).toEqual([]);
  });

  it('accepts a rubric that has no assertion (informational rubric)', () => {
    expect(
      issuesOf(configWith({ assertions: { satisfiesRequirements: { minProbability: 0.85 } } }))
    ).toEqual([]);
  });

  it('rejects an assertion whose key matches no rubric', () => {
    const issues = issuesOf(
      configWith({ assertions: { satisfiesRequirement: { minProbability: 0.85 } } })
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('zones.auth.assertions.satisfiesRequirement');
  });

  it('rejects probability thresholds outside [0, 1]', () => {
    const issues = issuesOf(
      configWith({ assertions: { satisfiesRequirements: { maxProbability: 15 } } })
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('zones.auth.assertions.satisfiesRequirements.maxProbability');
  });

  it('rejects non-numeric thresholds', () => {
    const issues = issuesOf(
      configWith({ assertions: { satisfiesRequirements: { minProbability: '0.85' } } })
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('minProbability');
  });

  it('rejects minProbability greater than maxProbability', () => {
    const issues = issuesOf(
      configWith({
        assertions: { satisfiesRequirements: { minProbability: 0.9, maxProbability: 0.2 } },
      })
    );

    expect(issues).toHaveLength(1);
  });

  it('rejects assertion options that do not belong to the rubric type', () => {
    const issues = issuesOf(
      configWith({ assertions: { satisfiesRequirements: { allowedChoices: ['secure'] } } })
    );

    expect(issues.some((issue) => issue.includes('allowedChoices'))).toBe(true);
  });

  it('rejects an assertion that sets no threshold at all', () => {
    const issues = issuesOf(configWith({ assertions: { satisfiesRequirements: {} } }));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('zones.auth.assertions.satisfiesRequirements');
  });

  it('rejects allowedChoices and blockedChoices that are not options of the rubric', () => {
    const issues = issuesOf(
      configWith({
        assertions: { securityPosture: { allowedChoices: ['secur'], blockedChoices: ['unsafe'] } },
      })
    );

    expect(issues).toHaveLength(2);
    expect(issues[0]).toContain('"secur"');
    expect(issues[1]).toContain('"unsafe"');
  });

  it('rejects score thresholds outside the rubric scale', () => {
    const issues = issuesOf(configWith({ assertions: { completeness: { minScore: 5 } } }));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('zones.auth.assertions.completeness.minScore');
  });

  it('rejects a confidence threshold outside [0, 1]', () => {
    const issues = issuesOf(
      configWith({ assertions: { completeness: { minScore: 1, minConfidence: 70 } } })
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('minConfidence');
  });

  it('rejects zones with a missing specPath, no include pattern, or no rubrics', () => {
    expect(issuesOf(configWith({ specPath: '' })).some((issue) => issue.includes('specPath'))).toBe(
      true
    );
    expect(
      issuesOf(configWith({ codePaths: ['!src/**/*.test.ts'] })).some((issue) =>
        issue.includes('codePaths')
      )
    ).toBe(true);
    expect(issuesOf(configWith({ rubrics: {} })).some((issue) => issue.includes('rubrics'))).toBe(
      true
    );
  });

  it('rejects malformed rubrics', () => {
    const issues = issuesOf(
      configWith({
        rubrics: {
          noQuestion: { type: 'noul', question: '' },
          oneLevel: { type: 'score', description: 'x', levels: ['only'] },
          oneOption: { type: 'choice', description: 'x', options: { only: 'x' } },
          unknownType: { type: 'rank' },
        },
      })
    );

    expect(issues).toHaveLength(4);
  });

  it('rejects a configuration without zones', () => {
    expect(issuesOf({ zones: {} })).toHaveLength(1);
  });

  it('reports every issue at once', () => {
    const issues = issuesOf(
      configWith({
        assertions: {
          satisfiesRequirement: { minProbability: 0.85 },
          completeness: { minScore: 9 },
        },
      })
    );

    expect(issues).toHaveLength(2);
  });
});

describe('runVerification configuration gate', () => {
  it('refuses to evaluate an invalid configuration', async () => {
    const calls: EvaluationInput[] = [];
    const evaluator: JevEvaluator = {
      async evaluate(input): Promise<Record<string, AnyRubricResult>> {
        calls.push(input);
        return {};
      },
    };

    await assert.rejects(
      () =>
        runVerification(
          configWith({ assertions: { satisfiesRequirement: { minProbability: 0.85 } } }),
          {
            cwd: pkgRoot,
            evaluator,
          }
        ),
      ConfigValidationError
    );
    expect(calls).toHaveLength(0);
  });
});
