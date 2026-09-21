import { describe, test as it } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { expect } from './test-utils.js';
import { runVerification } from '../src/runner/engine.js';
import { formatTerminalReport, formatMarkdownReport } from '../src/runner/reporter.js';
import { MockJevEvaluator, type JevEvaluator } from '../src/evaluator/jev-evaluator.js';
import sampleConfig from './fixtures/sample.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('jev-spec Runner & Engine', () => {
  it('runs end-to-end verification with mock evaluator on sample config', async () => {
    // Resolve relative to package root
    const pkgRoot = path.resolve(__dirname, '../..');
    const result = await runVerification(sampleConfig, {
      cwd: pkgRoot,
      evaluator: new MockJevEvaluator(),
    });

    expect(result.passed).toBe(true);
    expect(result.zones).toHaveLength(1);

    const authZone = result.zones[0];
    expect(authZone.zoneName).toBe('auth');
    expect(authZone.passed).toBe(true);
    expect(authZone.evaluations).toHaveLength(4);

    // Verify terminal and markdown report generation
    const terminalReport = formatTerminalReport(result);
    expect(terminalReport).toContain('Zone: auth');
    expect(terminalReport).toContain('ALL CHECKS PASSED');

    const mdReport = formatMarkdownReport(result);
    expect(mdReport).toContain('jev-spec` Verification Summary');
    expect(mdReport).toContain('| `auth` | ✅ PASS |');
  });

  it('flags mock results so they cannot be mistaken for a real verification', async () => {
    const pkgRoot = path.resolve(__dirname, '../..');
    const result = await runVerification(sampleConfig, { cwd: pkgRoot });

    expect(result.mock).toBe(true);
    expect(formatTerminalReport(result)).toContain('MOCK');
    expect(formatMarkdownReport(result)).toContain('MOCK');
  });

  it('does not flag results produced by a non-mock evaluator', async () => {
    const pkgRoot = path.resolve(__dirname, '../..');
    const liveLikeEvaluator: JevEvaluator = {
      async evaluate() {
        return {
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
        };
      },
    };

    const result = await runVerification(sampleConfig, { cwd: pkgRoot, evaluator: liveLikeEvaluator });

    expect(result.passed).toBe(true);
    expect(result.mock).toBe(undefined);
    expect(formatTerminalReport(result).includes('MOCK')).toBe(false);
  });
});
