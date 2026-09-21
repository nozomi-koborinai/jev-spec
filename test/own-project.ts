import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { choice, defineConfig, noul, score } from '../src/index.js';

/**
 * The happy-path input of the tests is this repository itself: a real spec and the real file
 * that implements it. Tests that read them assert structure only, so that editing a requirement
 * never breaks a test. Tests that need broken or contrived input build it in a temporary
 * directory instead.
 */
export const OWN_SPEC_PATH = 'docs/specs/exit-codes.md';
export const OWN_CODE_PATH = 'src/cli/main.ts';
export const OWN_REQUIREMENT_PREFIX = 'REQ-EXIT-';
export const SAMPLE_TARGET = 'exitCodes';

/** The requirement IDs that the spec declares, read from its headings and never hard-coded. */
export async function ownRequirementIds(pkgRoot: string): Promise<string[]> {
  const text = await fs.readFile(path.join(pkgRoot, OWN_SPEC_PATH), 'utf-8');
  return [...text.matchAll(/^### (REQ-[A-Z]+-\d{2}): /gm)].map((match) => match[1]);
}

/** One target over the real spec and code with one rubric of every type, in mock mode. */
export const sampleConfig = defineConfig({
  client: { mock: true },
  targets: {
    [SAMPLE_TARGET]: {
      description: 'Exit codes of the check command',
      specPath: OWN_SPEC_PATH,
      codePaths: [OWN_CODE_PATH],
      specFilter: { requirementPrefix: OWN_REQUIREMENT_PREFIX },
      rubrics: {
        satisfiesRequirements: noul('Does the code satisfy the requirements of the spec?'),
        introducesUnspecifiedBehavior: noul('Does the code introduce unspecified behaviour?'),
        securityPosture: choice('How the command treats an error', {
          secure: 'The error is reported and ends the run',
          insecure: 'The error is swallowed',
        }),
        implementationCompleteness: score('Degree of completeness', [
          'Stub',
          'Basic',
          'Feature Complete',
        ]),
      },
      assertions: {
        satisfiesRequirements: { minProbability: 0.8 },
        introducesUnspecifiedBehavior: { maxProbability: 0.15 },
        securityPosture: { allowedChoices: ['secure'], minConfidence: 0.7 },
        implementationCompleteness: { minScore: 1.5 },
      },
    },
  },
});
