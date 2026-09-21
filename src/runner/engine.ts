import { validateConfig } from '../config-validation.js';
import { type ExtractedCodeContext, extractCodeContext } from '../context/code-extractor.js';
import type { GitDiffOptions } from '../context/types.js';
import {
  createJevEvaluator,
  isModelAlias,
  type JevEvaluator,
  MockJevEvaluator,
  resolveModel,
} from '../evaluator/jev-evaluator.js';
import { loadSpec } from '../parser/markdown-parser.js';
import type {
  AnyRubric,
  AssertionEvaluation,
  JevSpecConfig,
  OverallCheckResult,
  TargetCheckResult,
} from '../types.js';
import { assertRubric } from './assertion-runner.js';

export interface RunOptions {
  readonly cwd?: string;
  readonly target?: string;
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

/**
 * Requirement IDs of the specification that no rubric mentions. jev-spec does not check them.
 *
 * A rubric mentions a requirement in its name or in its text. The name is the better place: it is
 * never sent to the model, and an ID inside a question is noise for the model.
 */
function findUnreferencedRequirementIds(
  requirementIds: readonly string[],
  rubrics: Readonly<Record<string, AnyRubric>>
): string[] {
  const text = Object.entries(rubrics)
    .map(([name, rubric]) => `${name}\n${rubricText(rubric)}`)
    .join('\n');
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
      `no rubric names ${unreferencedRequirementIds.join(', ')}: jev-spec does not check these requirements`
    );
  }
  if (codeContext.files.length === 0) {
    warnings.push(
      'codePaths matched no file: the target would be evaluated against an empty implementation'
    );
  }
  if (codeContext.truncated) {
    warnings.push(
      'the code context exceeds the character budget and would be cut: narrow codePaths or split the target'
    );
  }
  return warnings;
}

/** Dry-run warnings about the setup as a whole rather than about one target. */
function setupWarnings(config: JevSpecConfig): string[] {
  if (config.client?.mock) {
    return [];
  }
  const model = resolveModel(config.client);
  if (!isModelAlias(model)) {
    return [];
  }
  return [
    `the model is not pinned: "${model}" is an alias that moves to a newer model with every release, so a result can change without any change in this repository. Set client.model (or TYPESAFE_DEFAULT_MODEL) to a versioned ID; every report prints the one that answered`,
  ];
}

export async function runChecks(
  config: JevSpecConfig,
  options: RunOptions = {}
): Promise<OverallCheckResult> {
  validateConfig(config);

  const cwd = options.cwd ?? process.cwd();
  const startTime = Date.now();

  // Created on first use: a run in which every target is skipped needs no API key.
  let evaluator = options.evaluator;
  const getEvaluator = (): JevEvaluator => (evaluator ??= createJevEvaluator(config.client));
  const isMock = options.evaluator
    ? options.evaluator instanceof MockJevEvaluator
    : Boolean(config.client?.mock);

  const targetNames = options.target ? [options.target] : Object.keys(config.targets);
  const runWarnings = options.dryRun ? setupWarnings(config) : [];

  const targetResults: TargetCheckResult[] = [];

  for (const targetName of targetNames) {
    const targetConfig = config.targets[targetName];
    if (!targetConfig) {
      throw new Error(`Target "${targetName}" not found in configuration`);
    }

    const targetStart = Date.now();

    const codeContext = await extractCodeContext(targetConfig.codePaths, {
      cwd,
      gitDiff: options.gitDiff,
    });

    // Decide this before touching the spec, so an untouched target can never fail the run.
    // The changed files decide, not the files that are left: a target whose code was deleted
    // has changed more than any other.
    if (codeContext.mode === 'diff' && (codeContext.changedFiles ?? []).length === 0) {
      targetResults.push({
        targetName,
        specFiles: [targetConfig.specPath],
        codeFiles: [],
        passed: true,
        evaluations: [],
        durationMs: Date.now() - targetStart,
        estimatedCostUsd: 0,
        skipped: true,
        skipReason: 'No changed files match the codePaths of this target',
      });
      continue;
    }

    const parsedSpec = await loadSpec(targetConfig.specPath, cwd, targetConfig.specFilter);

    const totalChars = parsedSpec.filteredText.length + codeContext.combinedPromptContext.length;
    const estTokens = Math.ceil(totalChars / 4);
    const estCost = (estTokens / 1_000_000) * 0.042;

    if (options.dryRun) {
      const requirementIds = [...new Set(parsedSpec.requirements.map((req) => req.id))];
      const unreferencedRequirementIds = findUnreferencedRequirementIds(
        requirementIds,
        targetConfig.rubrics
      );
      targetResults.push({
        targetName,
        specFiles: [targetConfig.specPath],
        codeFiles: codeContext.files.map((f) => f.relativePath),
        passed: true,
        evaluations: [],
        durationMs: Date.now() - targetStart,
        estimatedCostUsd: estCost,
        ...(codeContext.changedFiles && { changedFiles: codeContext.changedFiles }),
        plan: {
          specSections: parsedSpec.sections.map((section) => section.title),
          requirementIds,
          specChars: parsedSpec.filteredText.length,
          codeChars: codeContext.combinedPromptContext.length,
          rubrics: Object.keys(targetConfig.rubrics),
          unreferencedRequirementIds,
          warnings: planWarnings(codeContext, unreferencedRequirementIds),
        },
      });
      continue;
    }

    const { answers: rubricResults, model } = await getEvaluator().evaluate({
      specContext: parsedSpec.filteredText,
      codeContext: codeContext.combinedPromptContext,
      rubrics: targetConfig.rubrics,
    });

    const evaluations: AssertionEvaluation[] = [];
    let targetPassed = true;

    for (const [name, rubric] of Object.entries(targetConfig.rubrics)) {
      const typedRubric = rubric as AnyRubric;
      const result = rubricResults[name];
      if (!result) {
        targetPassed = false;
        evaluations.push({
          rubricName: name,
          rubric: typedRubric,
          result: { type: 'noul', probability: 0 },
          passed: false,
          reason: 'Evaluator did not return a result for this rubric',
        });
        continue;
      }

      const assertion = targetConfig.assertions[name];
      const ev = assertRubric(name, typedRubric, result, assertion);
      if (!ev.passed) {
        targetPassed = false;
      }
      evaluations.push(ev);
    }

    const targetDuration = Date.now() - targetStart;

    targetResults.push({
      targetName,
      specFiles: [targetConfig.specPath],
      codeFiles: codeContext.files.map((f) => f.relativePath),
      passed: targetPassed,
      evaluations,
      durationMs: targetDuration,
      estimatedCostUsd: estCost,
      ...(model && { model }),
      ...(codeContext.changedFiles && { changedFiles: codeContext.changedFiles }),
    });
  }

  const totalDuration = Date.now() - startTime;
  const overallPassed = targetResults.every((z) => z.passed);
  const totalCost = targetResults.reduce((acc, z) => acc + z.estimatedCostUsd, 0);

  return {
    ...(options.dryRun ? { dryRun: true } : isMock && { mock: true }),
    ...(options.dryRun && runWarnings.length > 0 && { warnings: runWarnings }),
    passed: overallPassed,
    targets: targetResults,
    totalDurationMs: totalDuration,
    totalEstimatedCostUsd: totalCost,
  };
}
