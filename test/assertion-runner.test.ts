import { describe, test as it } from 'node:test';
import { expect } from './test-utils.js';
import { assertRubric } from '../src/runner/assertion-runner.js';
import { noul, choice, score } from '../src/dsl.js';
import type { ChoiceResult, NoulResult, ScoreResult } from '../src/types.js';

const noulRubric = noul('Does the code satisfy the requirement?');
const choiceRubric = choice('Security posture', { secure: 'ok', insecure: 'not ok' });
const scoreRubric = score('Completeness', ['Stub', 'Partial', 'Complete']);

const noulResult = (probability: number): NoulResult => ({ type: 'noul', probability });

const choiceResult = (selected: 'secure' | 'insecure', confidence: number): ChoiceResult => ({
  type: 'choice',
  choice: selected,
  confidence,
  distribution: { secure: 0.5, insecure: 0.5 },
});

const scoreResult = (value: number, confidence: number): ScoreResult => ({
  type: 'score',
  score: value,
  maxScore: 2,
  confidence,
  selectedLevel: 'Partial',
  levelProbabilities: [0.1, 0.8, 0.1],
});

describe('assertRubric', () => {
  it('enforces noul probability thresholds', () => {
    expect(assertRubric('r', noulRubric, noulResult(0.9), { minProbability: 0.85 }).passed).toBe(true);
    expect(assertRubric('r', noulRubric, noulResult(0.84), { minProbability: 0.85 }).passed).toBe(false);
    expect(assertRubric('r', noulRubric, noulResult(0.1), { maxProbability: 0.15 }).passed).toBe(true);
    expect(assertRubric('r', noulRubric, noulResult(0.16), { maxProbability: 0.15 }).passed).toBe(false);
  });

  it('fails a noul assertion when the evaluator returns a non-finite probability', () => {
    expect(assertRubric('r', noulRubric, noulResult(Number.NaN), { minProbability: 0.85 }).passed).toBe(false);
    expect(assertRubric('r', noulRubric, noulResult(Number.NaN), { maxProbability: 0.15 }).passed).toBe(false);
  });

  it('enforces allowed and blocked choices', () => {
    expect(
      assertRubric('r', choiceRubric, choiceResult('secure', 0.9), { allowedChoices: ['secure'] }).passed
    ).toBe(true);
    expect(
      assertRubric('r', choiceRubric, choiceResult('insecure', 0.9), { allowedChoices: ['secure'] }).passed
    ).toBe(false);
    expect(
      assertRubric('r', choiceRubric, choiceResult('insecure', 0.9), { blockedChoices: ['insecure'] }).passed
    ).toBe(false);
  });

  it('fails a choice assertion when the confidence is below minConfidence or non-finite', () => {
    const assertion = { allowedChoices: ['secure'], minConfidence: 0.75 } as const;
    expect(assertRubric('r', choiceRubric, choiceResult('secure', 0.8), assertion).passed).toBe(true);
    expect(assertRubric('r', choiceRubric, choiceResult('secure', 0.7), assertion).passed).toBe(false);
    expect(assertRubric('r', choiceRubric, choiceResult('secure', Number.NaN), assertion).passed).toBe(false);
  });

  it('enforces score thresholds', () => {
    expect(assertRubric('r', scoreRubric, scoreResult(1.9, 0.9), { minScore: 1.8 }).passed).toBe(true);
    expect(assertRubric('r', scoreRubric, scoreResult(1.7, 0.9), { minScore: 1.8 }).passed).toBe(false);
    expect(assertRubric('r', scoreRubric, scoreResult(1.2, 0.9), { maxScore: 1.0 }).passed).toBe(false);
    expect(assertRubric('r', scoreRubric, scoreResult(Number.NaN, 0.9), { minScore: 1.8 }).passed).toBe(false);
  });

  it('enforces minConfidence on score assertions', () => {
    const assertion = { minScore: 1.0, minConfidence: 0.7 };
    expect(assertRubric('r', scoreRubric, scoreResult(1.5, 0.8), assertion).passed).toBe(true);
    expect(assertRubric('r', scoreRubric, scoreResult(1.5, 0.6), assertion).passed).toBe(false);
    expect(assertRubric('r', scoreRubric, scoreResult(1.5, Number.NaN), assertion).passed).toBe(false);
  });

  it('treats a rubric without an assertion as informational', () => {
    expect(assertRubric('r', noulRubric, noulResult(0.01)).passed).toBe(true);
  });
});
