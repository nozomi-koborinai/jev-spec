import * as path from 'node:path';
import { describe, test as it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { type JevEvaluator, MockJevEvaluator } from '../src/evaluator/jev-evaluator.js';
import { runChecks } from '../src/runner/engine.js';
import { formatMarkdownReport, formatTerminalReport } from '../src/runner/reporter.js';
import sampleConfig from './fixtures/sample.config.js';
import { expect } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('jev-spec Runner & Engine', () => {
  it('runs an end-to-end check with the mock evaluator on the sample config', async () => {
    // Resolve relative to package root
    const pkgRoot = path.resolve(__dirname, '../..');
    const result = await runChecks(sampleConfig, {
      cwd: pkgRoot,
      evaluator: new MockJevEvaluator(),
    });

    expect(result.passed).toBe(true);
    expect(result.targets).toHaveLength(1);

    const authTarget = result.targets[0];
    expect(authTarget.targetName).toBe('auth');
    expect(authTarget.passed).toBe(true);
    expect(authTarget.evaluations).toHaveLength(4);

    // Terminal and markdown report generation
    const terminalReport = formatTerminalReport(result);
    expect(terminalReport).toContain('Target: auth');
    expect(terminalReport).toContain('ALL CHECKS PASSED');

    const mdReport = formatMarkdownReport(result);
    expect(mdReport).toContain('jev-spec` Check Summary');
    expect(mdReport).toContain('| `auth` | ✅ PASS |');
  });

  it('flags mock results so they cannot be mistaken for a real check', async () => {
    const pkgRoot = path.resolve(__dirname, '../..');
    const result = await runChecks(sampleConfig, { cwd: pkgRoot });

    expect(result.mock).toBe(true);
    expect(formatTerminalReport(result)).toContain('MOCK');
    expect(formatMarkdownReport(result)).toContain('MOCK');
  });

  it('does not flag results produced by a non-mock evaluator', async () => {
    const pkgRoot = path.resolve(__dirname, '../..');
    const liveLikeEvaluator: JevEvaluator = {
      async evaluate() {
        return {
          answers: {
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
          },
        };
      },
    };

    const result = await runChecks(sampleConfig, {
      cwd: pkgRoot,
      evaluator: liveLikeEvaluator,
    });

    expect(result.passed).toBe(true);
    expect(result.mock).toBe(undefined);
    expect(formatTerminalReport(result).includes('MOCK')).toBe(false);
  });

  it('names the target and says that checks failed when an assertion is violated', async () => {
    const pkgRoot = path.resolve(__dirname, '../..');
    const driftedEvaluator: JevEvaluator = {
      async evaluate() {
        return {
          answers: {
            satisfiesRequirements: { type: 'noul', probability: 0.08 },
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
          },
        };
      },
    };

    const result = await runChecks(sampleConfig, { cwd: pkgRoot, evaluator: driftedEvaluator });
    const terminal = formatTerminalReport(result);

    expect(result.passed).toBe(false);
    expect(result.targets[0].targetName).toBe('auth');
    expect(terminal).toContain('=== jev-spec Check Report ===');
    expect(terminal).toContain('Target: auth');
    expect(terminal).toContain('CHECKS FAILED');
    expect(terminal.includes('VERIFICATION')).toBe(false);
  });
});
