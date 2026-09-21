/**
 * Primitive Jev decision types:
 * - noul: calibrated boolean probability in [0, 1]
 * - choice: categorical distribution over a set of options
 * - score: ordinal score on a defined rubric scale
 */

export interface NoulRubric {
  readonly type: 'noul';
  readonly question: string;
}

export interface ChoiceRubric<T extends string = string> {
  readonly type: 'choice';
  readonly description: string;
  readonly options: Record<T, string>;
}

export interface ScoreRubric {
  readonly type: 'score';
  readonly description: string;
  readonly levels: readonly string[];
}

export type AnyRubric = NoulRubric | ChoiceRubric | ScoreRubric;

// Assertions
export interface NoulAssertion {
  readonly minProbability?: number;
  readonly maxProbability?: number;
}

export interface ChoiceAssertion<T extends string = string> {
  readonly allowedChoices?: readonly T[];
  readonly blockedChoices?: readonly T[];
  readonly minConfidence?: number;
}

export interface ScoreAssertion {
  readonly minScore?: number;
  readonly maxScore?: number;
  readonly minConfidence?: number;
}

export type AnyAssertion = NoulAssertion | ChoiceAssertion | ScoreAssertion;

export type AssertionMap<R extends Record<string, AnyRubric>> = {
  [K in keyof R]?: R[K] extends NoulRubric
    ? NoulAssertion
    : R[K] extends ChoiceRubric<infer C>
      ? ChoiceAssertion<C>
      : R[K] extends ScoreRubric
        ? ScoreAssertion
        : never;
};

// Spec Filter
export interface SpecFilter {
  readonly headings?: readonly string[];
  readonly requirementPrefix?: string;
  readonly tags?: readonly string[];
}

// Zone Definition
export interface ZoneConfig<R extends Record<string, AnyRubric> = Record<string, AnyRubric>> {
  readonly description?: string;
  readonly specPath: string;
  readonly codePaths: readonly string[];
  readonly specFilter?: SpecFilter;
  readonly rubrics: R;
  readonly assertions: AssertionMap<R>;
}

/**
 * A zone as the engine sees it: rubric names are not tracked at the type level, so every
 * `ZoneConfig<R>` fits, as do hand-written configurations that never went through defineConfig.
 */
export interface AnyZoneConfig extends Omit<ZoneConfig, 'rubrics' | 'assertions'> {
  readonly rubrics: Readonly<Record<string, AnyRubric>>;
  readonly assertions: Readonly<Record<string, AnyAssertion | undefined>>;
}

// Client Configuration
export interface JevClientConfig {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly allowCustomBaseUrl?: boolean;
  readonly timeoutMs?: number;
  readonly mock?: boolean;
}

// Top-level Configuration
export interface JevSpecConfig {
  readonly client?: JevClientConfig;
  readonly zones: Record<string, AnyZoneConfig>;
}

// Evaluation Results
export interface NoulResult {
  readonly type: 'noul';
  readonly probability: number;
}

export interface ChoiceResult<T extends string = string> {
  readonly type: 'choice';
  readonly choice: T;
  readonly confidence: number;
  readonly distribution: Record<T, number>;
}

export interface ScoreResult {
  readonly type: 'score';
  readonly score: number;
  readonly maxScore: number;
  readonly confidence: number;
  readonly selectedLevel: string;
  readonly levelProbabilities: readonly number[];
}

export type AnyRubricResult = NoulResult | ChoiceResult | ScoreResult;

export interface AssertionEvaluation {
  readonly rubricName: string;
  readonly rubric: AnyRubric;
  readonly result: AnyRubricResult;
  readonly passed: boolean;
  readonly reason?: string;
}

/** What a dry run would send for a zone. Nothing in it comes from the Jev API. */
export interface ZonePlan {
  /** Titles of the specification sections that would be sent. */
  readonly specSections: readonly string[];
  /** Requirement IDs found in those sections. */
  readonly requirementIds: readonly string[];
  readonly specChars: number;
  readonly codeChars: number;
  /** Names of the rubrics that would be asked. */
  readonly rubrics: readonly string[];
  /** Requirement IDs of the specification that no rubric mentions: jev-spec does not verify them. */
  readonly unreferencedRequirementIds: readonly string[];
  /** Problems that do not stop the run but make the zone less meaningful. */
  readonly warnings: readonly string[];
}

export interface ZoneCheckResult {
  readonly zoneName: string;
  readonly specFiles: readonly string[];
  readonly codeFiles: readonly string[];
  readonly passed: boolean;
  readonly evaluations: readonly AssertionEvaluation[];
  readonly durationMs: number;
  readonly estimatedCostUsd: number;
  /** True when the zone was not evaluated (e.g. no changed file matched its codePaths in diff mode). */
  readonly skipped?: boolean;
  readonly skipReason?: string;
  /** Present in a dry run instead of evaluations. */
  readonly plan?: ZonePlan;
}

export interface OverallCheckResult {
  /** True when results come from the offline mock evaluator rather than the Jev API. */
  readonly mock?: boolean;
  /** True when nothing was evaluated: configuration, spec parsing and file matching only. */
  readonly dryRun?: boolean;
  readonly passed: boolean;
  readonly zones: readonly ZoneCheckResult[];
  readonly totalDurationMs: number;
  readonly totalEstimatedCostUsd: number;
}
