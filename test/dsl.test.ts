import { describe, test as it } from 'node:test';
import { expect } from './test-utils.js';
import { noul, choice, score, defineConfig } from '../src/dsl.js';

describe('jev-spec DSL', () => {
  it('creates noul rubric', () => {
    const r = noul('Does it satisfy requirement REQ-01?');
    expect(r.type).toBe('noul');
    expect(r.question).toBe('Does it satisfy requirement REQ-01?');
  });

  it('creates choice rubric', () => {
    const r = choice('Security compliance', {
      compliant: 'Complies with all rules',
      vulnerable: 'Contains security flaws',
    });
    expect(r.type).toBe('choice');
    expect(r.options.compliant).toBe('Complies with all rules');
  });

  it('creates score rubric', () => {
    const r = score('Completeness', ['Stub', 'Partial', 'Complete']);
    expect(r.type).toBe('score');
    expect(r.levels).toHaveLength(3);
  });

  it('throws on score with fewer than 2 levels', () => {
    expect(() => score('Invalid', ['Only one'])).toThrow(/between 2 and 10/);
  });

  it('validates defineConfig type inference', () => {
    const cfg = defineConfig({
      zones: {
        testZone: {
          specPath: 'spec.md',
          codePaths: ['src/**/*.ts'],
          rubrics: {
            check: noul('Is it working?'),
          },
          assertions: {
            check: { minProbability: 0.9 },
          },
        },
      },
    });
    expect(cfg.zones.testZone).toBeDefined();
  });

  it('type-checks assertions against the rubrics of their own zone', () => {
    // Compile-time test: every @ts-expect-error below must correspond to a real type error,
    // otherwise `tsc` fails the build with "Unused '@ts-expect-error' directive".
    const cfg = defineConfig({
      zones: {
        auth: {
          specPath: 'spec.md',
          codePaths: ['src/**/*.ts'],
          rubrics: {
            satisfies: noul('Does it satisfy the spec?'),
            posture: choice('Security posture', { secure: 'ok', insecure: 'not ok' }),
            completeness: score('Completeness', ['Stub', 'Partial', 'Complete']),
          },
          assertions: {
            satisfies: { minProbability: 0.85 },
            posture: { allowedChoices: ['secure'], minConfidence: 0.75 },
            completeness: { minScore: 1.5 },
            // @ts-expect-error assertion key does not match any rubric in this zone
            satisfie: { minProbability: 0.85 },
          },
        },
        billing: {
          specPath: 'billing.md',
          codePaths: ['src/billing/**/*.ts'],
          rubrics: {
            posture: choice('Rounding mode', { halfUp: 'Round half up', bankers: 'Round half even' }),
            correct: noul('Are invoices computed correctly?'),
          },
          assertions: {
            // @ts-expect-error 'secure' belongs to the auth zone, not to this rubric
            posture: { allowedChoices: ['secure'] },
            // @ts-expect-error allowedChoices is not a valid option for a noul rubric
            correct: { allowedChoices: ['halfUp'] },
          },
        },
      },
    });

    expect(Object.keys(cfg.zones)).toEqual(['auth', 'billing']);
  });
});
