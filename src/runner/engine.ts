import { validateConfig } from '../config-validation.js';
import { type ExtractedCodeContext, extractCodeContext } from '../context/code-extractor.js';
import type { GitDiffOptions } from '../context/types.js';
import {
  createJevEvaluator,
  type JevEvaluator,
  MockJevEvaluator,
} from '../evaluator/jev-evaluator.js';
import { loadSpec } from '../parser/markdown-parser.js';
import type {
  AnyRubric,
  AssertionEvaluation,
  JevSpecConfig,
  OverallCheckResult,
  ZoneCheckResult,
} from '../types.js';
import { assertRubric } from './assertion-runner.js';

export interface RunOptions {
  readonly cwd?: string;
  readonly zone?: string;
  readonly evaluator?: JevEvaluator;
  readonly gitDiff?: GitDiffOptions;
  /** Validate configuration, spec parsing and file matching without evaluating anything. */
  readonly dryRun?: boolean;
}

/** Every piece of text a rubric sends to the model: its question or description, options and levels. */
function rubricText(rubric: AnyRubric): string {
  if (rubric.type === 'noul') {
    return rubric.question;
  }
  if (rubric.type === 'choice') {
    return [rubric.description, ...Object.values(rubric.options)].join('\n');
  }
  return [rubric.description, ...rubric.levels].join('\n');
}

/** Requirement IDs of the specification that no rubric mentions. jev-spec does not verify them. */
function findUnreferencedRequirementIds(
  requirementIds: readonly string[],
  rubrics: Readonly<Record<string, AnyRubric>>
): string[] {
  const text = Object.values(rubrics).map(rubricText).join('\n');
  // Whole-ID match: REQ-AUTH-1 must not count as named by a rubric that mentions REQ-AUTH-10.
  return requirementIds.filter((id) => {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return !new RegExp(`(?<![A-Za-z0-9_-])${escaped}(?![A-Za-z0-9_-])`, 'i').test(text);
  });
}

/**
 * Problems a dry run can see that do not stop a real run but make its verdicts less meaningful.
 */
function planWarnings(
  codeContext: ExtractedCodeContext,
  unreferencedRequirementIds: readonly string[]
): string[] {
  const warnings: string[] = [];
  if (unreferencedRequirementIds.length > 0) {
    warnings.push(
      `no rubric names ${unreferencedRequirementIds.join(', ')}: jev-spec does not verify these requirements`
    );
  }
  if (codeContext.files.length === 0) {
    warnings.push(
      'codePaths matched no file: the zone would be evaluated against an empty implementation'
    );
  }
  if (codeContext.truncated) {
    warnings.push(
      'the code context exceeds the character budget and would be cut: narrow codePaths or split the zone'
    );
  }
  return warnings;
}

export async function runVerification(
  config: JevSpecConfig,
  options: RunOptions = {}
): Promise<OverallCheckResult> {
  validateConfig(config);

  const cwd = options.cwd ?? process.cwd();
  const startTime = Date.now();

  // Created on first use: a run in which every zone is skipped needs no API key.
  let evaluator = options.evaluator;
  const getEvaluator = (): JevEvaluator => (evaluator ??= createJevEvaluator(config.client));
  const isMock = options.evaluator
    ? options.evaluator instanceof MockJevEvaluator
    : Boolean(config.client?.mock);

  const zoneNames = options.zone ? [options.zone] : Object.keys(config.zones);

  const zoneResults: ZoneCheckResult[] = [];

  for (const zoneName of zoneNames) {
    const zoneConfig = config.zones[zoneName];
    if (!zoneConfig) {
      throw new Error(`Zone "${zoneName}" not found in configuration`);
    }

    const zoneStart = Date.now();

    const codeContext = await extractCodeContext(zoneConfig.codePaths, {
      cwd,
      gitDiff: options.gitDiff,
    });

    // Decide this before touching the spec, so an untouched zone can never fail the run.
    if (codeContext.mode === 'diff' && codeContext.files.length === 0) {
      zoneResults.push({
        zoneName,
        specFiles: [zoneConfig.specPath],
        codeFiles: [],
        passed: true,
        evaluations: [],
        durationMs: Date.now() - zoneStart,
        estimatedCostUsd: 0,
        skipped: true,
        skipReason: 'No changed files match the codePaths of this zone',
      });
      continue;
    }

    const parsedSpec = await loadSpec(zoneConfig.specPath, cwd, zoneConfig.specFilter);

    const totalChars = parsedSpec.filteredText.length + codeContext.combinedPromptContext.length;
    const estTokens = Math.ceil(totalChars / 4);
    const estCost = (estTokens / 1_000_000) * 0.042;

    if (options.dryRun) {
      const requirementIds = [...new Set(parsedSpec.requirements.map((req) => req.id))];
      const unreferencedRequirementIds = findUnreferencedRequirementIds(
        requirementIds,
        zoneConfig.rubrics
      );
      zoneResults.push({
        zoneName,
        specFiles: [zoneConfig.specPath],
        codeFiles: codeContext.files.map((f) => f.relativePath),
        passed: true,
        evaluations: [],
        durationMs: Date.now() - zoneStart,
        estimatedCostUsd: estCost,
        plan: {
          specSections: parsedSpec.sections.map((section) => section.title),
          requirementIds,
          specChars: parsedSpec.filteredText.length,
          codeChars: codeContext.combinedPromptContext.length,
          rubrics: Object.keys(zoneConfig.rubrics),
          unreferencedRequirementIds,
          warnings: planWarnings(codeContext, unreferencedRequirementIds),
        },
      });
      continue;
    }

    const rubricResults = await getEvaluator().evaluate({
      specContext: parsedSpec.filteredText,
      codeContext: codeContext.combinedPromptContext,
      rubrics: zoneConfig.rubrics,
    });

    const evaluations: AssertionEvaluation[] = [];
    let zonePassed = true;

    for (const [name, rubric] of Object.entries(zoneConfig.rubrics)) {
      const typedRubric = rubric as AnyRubric;
      const result = rubricResults[name];
      if (!result) {
        zonePassed = false;
        evaluations.push({
          rubricName: name,
          rubric: typedRubric,
          result: { type: 'noul', probability: 0 },
          passed: false,
          reason: 'Evaluator did not return a result for this rubric',
        });
        continue;
      }

      const assertion = zoneConfig.assertions[name];
      const ev = assertRubric(name, typedRubric, result, assertion);
      if (!ev.passed) {
        zonePassed = false;
      }
      evaluations.push(ev);
    }

    const zoneDuration = Date.now() - zoneStart;

    zoneResults.push({
      zoneName,
      specFiles: [zoneConfig.specPath],
      codeFiles: codeContext.files.map((f) => f.relativePath),
      passed: zonePassed,
      evaluations,
      durationMs: zoneDuration,
      estimatedCostUsd: estCost,
    });
  }

  const totalDuration = Date.now() - startTime;
  const overallPassed = zoneResults.every((z) => z.passed);
  const totalCost = zoneResults.reduce((acc, z) => acc + z.estimatedCostUsd, 0);

  return {
    ...(options.dryRun ? { dryRun: true } : isMock && { mock: true }),
    passed: overallPassed,
    zones: zoneResults,
    totalDurationMs: totalDuration,
    totalEstimatedCostUsd: totalCost,
  };
}
