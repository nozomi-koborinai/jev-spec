import type {
  AnyRubric,
  ChoiceRubric,
  JevClientConfig,
  JevSpecConfig,
  NoulRubric,
  ScoreRubric,
  TargetConfig,
} from './types.js';

/**
 * Creates a noul (boolean proposition) rubric.
 * Jev evaluates whether the proposition is true, returning a calibrated probability in [0, 1].
 */
export function noul(question: string): NoulRubric {
  return {
    type: 'noul',
    question,
  };
}

/**
 * Creates a choice (categorical distribution) rubric.
 * Jev predicts the distribution across the declared options and selects the best matching option.
 */
export function choice<T extends string>(
  description: string,
  options: Record<T, string>
): ChoiceRubric<T> {
  return {
    type: 'choice',
    description,
    options,
  };
}

/**
 * Creates a score (ordinal rubric) rubric with 2 to 10 scale levels.
 * Jev evaluates the state against the levels, returning a weighted score and probabilities.
 */
export function score(description: string, levels: readonly string[]): ScoreRubric {
  if (levels.length < 2 || levels.length > 10) {
    throw new Error(`Score rubric must have between 2 and 10 levels, got ${levels.length}`);
  }
  return {
    type: 'score',
    description,
    levels,
  };
}

/**
 * Configuration shape accepted by defineConfig. `Z` maps each target name to the rubrics
 * declared in that target, so assertions are checked against the rubrics of their own target.
 */
export interface JevSpecConfigInput<Z extends Record<string, Record<string, AnyRubric>>> {
  readonly client?: JevClientConfig;
  readonly targets: { readonly [K in keyof Z]: TargetConfig<Z[K]> };
}

/**
 * Type-safe configuration helper for jev-spec.config.ts.
 *
 * Assertion keys must name a rubric of the same target, assertion options must fit the rubric
 * type, and allowedChoices / blockedChoices must be option keys of the choice rubric.
 */
export function defineConfig<Z extends Record<string, Record<string, AnyRubric>>>(
  config: JevSpecConfigInput<Z>
): JevSpecConfig {
  return config;
}
