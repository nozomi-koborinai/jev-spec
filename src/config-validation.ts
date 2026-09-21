import type { JevSpecConfig } from './types.js';

export class ConfigValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid jev-spec configuration:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'ConfigValidationError';
  }
}

const ASSERTION_OPTIONS = {
  noul: ['minProbability', 'maxProbability'],
  choice: ['allowedChoices', 'blockedChoices', 'minConfidence'],
  score: ['minScore', 'maxScore', 'minConfidence'],
} as const;

type RubricType = keyof typeof ASSERTION_OPTIONS;

const MIN_SCORE_LEVELS = 2;
const MAX_SCORE_LEVELS = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRubricType(value: unknown): value is RubricType {
  return typeof value === 'string' && value in ASSERTION_OPTIONS;
}

/**
 * Validates a rubric and returns its type, or undefined when the rubric is unusable.
 */
function validateRubric(path: string, rubric: unknown, issues: string[]): RubricType | undefined {
  if (!isRecord(rubric) || !isRubricType(rubric.type)) {
    issues.push(`${path}: must be created with noul(), choice() or score()`);
    return undefined;
  }

  if (rubric.type === 'noul') {
    if (!isNonEmptyString(rubric.question)) {
      issues.push(`${path}.question: must be a non-empty string`);
      return undefined;
    }
  } else if (rubric.type === 'choice') {
    if (!isRecord(rubric.options) || Object.keys(rubric.options).length < 2) {
      issues.push(`${path}.options: must declare at least two options`);
      return undefined;
    }
  } else if (
    !Array.isArray(rubric.levels) ||
    rubric.levels.length < MIN_SCORE_LEVELS ||
    rubric.levels.length > MAX_SCORE_LEVELS
  ) {
    issues.push(
      `${path}.levels: must list between ${MIN_SCORE_LEVELS} and ${MAX_SCORE_LEVELS} levels`
    );
    return undefined;
  }

  return rubric.type;
}

/**
 * Checks an optional numeric threshold. Returns the value when it is present and valid.
 */
function validateThreshold(
  path: string,
  value: unknown,
  min: number,
  max: number,
  issues: string[]
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    issues.push(
      `${path}: must be a number between ${min} and ${max}, got ${JSON.stringify(value)}`
    );
    return undefined;
  }
  return value;
}

function validateOrdering(
  path: string,
  minName: string,
  min: number | undefined,
  maxName: string,
  max: number | undefined,
  issues: string[]
): void {
  if (min !== undefined && max !== undefined && min > max) {
    issues.push(`${path}: ${minName} (${min}) must not be greater than ${maxName} (${max})`);
  }
}

function validateChoiceList(
  path: string,
  value: unknown,
  optionKeys: readonly string[],
  issues: string[]
): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(`${path}: must be a non-empty array of option keys`);
    return;
  }
  for (const entry of value) {
    if (typeof entry !== 'string' || !optionKeys.includes(entry)) {
      issues.push(
        `${path}: ${JSON.stringify(entry)} is not an option of this rubric (options: ${optionKeys.join(', ')})`
      );
    }
  }
}

function validateAssertion(
  path: string,
  assertion: unknown,
  rubricType: RubricType,
  rubric: Record<string, unknown>,
  issues: string[]
): void {
  if (!isRecord(assertion)) {
    issues.push(`${path}: must be an object`);
    return;
  }

  const allowed: readonly string[] = ASSERTION_OPTIONS[rubricType];
  const keys = Object.keys(assertion).filter((key) => assertion[key] !== undefined);

  const unknownKeys = keys.filter((key) => !allowed.includes(key));
  for (const key of unknownKeys) {
    issues.push(
      `${path}.${key}: not a valid option for a ${rubricType} rubric (valid options: ${allowed.join(', ')})`
    );
  }

  if (keys.length === 0) {
    issues.push(
      `${path}: sets no threshold, so it can never fail (valid options: ${allowed.join(', ')})`
    );
    return;
  }

  if (rubricType === 'noul') {
    const min = validateThreshold(`${path}.minProbability`, assertion.minProbability, 0, 1, issues);
    const max = validateThreshold(`${path}.maxProbability`, assertion.maxProbability, 0, 1, issues);
    validateOrdering(path, 'minProbability', min, 'maxProbability', max, issues);
    return;
  }

  if (rubricType === 'choice') {
    const optionKeys = Object.keys(rubric.options as Record<string, unknown>);
    validateChoiceList(`${path}.allowedChoices`, assertion.allowedChoices, optionKeys, issues);
    validateChoiceList(`${path}.blockedChoices`, assertion.blockedChoices, optionKeys, issues);
    validateThreshold(`${path}.minConfidence`, assertion.minConfidence, 0, 1, issues);
    return;
  }

  const maxLevel = (rubric.levels as readonly unknown[]).length - 1;
  const min = validateThreshold(`${path}.minScore`, assertion.minScore, 0, maxLevel, issues);
  const max = validateThreshold(`${path}.maxScore`, assertion.maxScore, 0, maxLevel, issues);
  validateOrdering(path, 'minScore', min, 'maxScore', max, issues);
  validateThreshold(`${path}.minConfidence`, assertion.minConfidence, 0, 1, issues);
}

function validateTarget(path: string, target: unknown, issues: string[]): void {
  if (!isRecord(target)) {
    issues.push(`${path}: must be an object`);
    return;
  }

  if (!isNonEmptyString(target.specPath)) {
    issues.push(`${path}.specPath: must be a non-empty string`);
  }

  const codePaths = target.codePaths;
  if (
    !Array.isArray(codePaths) ||
    !codePaths.every(isNonEmptyString) ||
    !codePaths.some((pattern) => !pattern.startsWith('!'))
  ) {
    issues.push(
      `${path}.codePaths: must be an array of glob strings with at least one include pattern`
    );
  }

  const rubricTypes = new Map<string, RubricType | undefined>();
  if (!isRecord(target.rubrics) || Object.keys(target.rubrics).length === 0) {
    issues.push(`${path}.rubrics: must declare at least one rubric`);
  } else {
    for (const [name, rubric] of Object.entries(target.rubrics)) {
      rubricTypes.set(name, validateRubric(`${path}.rubrics.${name}`, rubric, issues));
    }
  }

  if (!isRecord(target.assertions)) {
    issues.push(`${path}.assertions: must be an object (use {} for informational targets)`);
    return;
  }

  for (const [name, assertion] of Object.entries(target.assertions)) {
    const assertionPath = `${path}.assertions.${name}`;
    if (!rubricTypes.has(name)) {
      const known = [...rubricTypes.keys()].join(', ') || 'none';
      issues.push(`${assertionPath}: no rubric with this name (rubrics: ${known})`);
      continue;
    }

    const rubricType = rubricTypes.get(name);
    if (rubricType === undefined) {
      continue; // the rubric itself is already reported as invalid
    }
    const rubric = (target.rubrics as Record<string, Record<string, unknown>>)[name];
    validateAssertion(assertionPath, assertion, rubricType, rubric, issues);
  }
}

/**
 * Validates a loaded configuration and throws a ConfigValidationError listing every problem.
 *
 * jev-spec is a gate: a mistyped assertion key or an out-of-range threshold must stop the run
 * instead of silently turning a check into one that can never fail.
 */
export function validateConfig(config: JevSpecConfig): void {
  const issues: string[] = [];
  const client: unknown = (config as { client?: unknown } | null | undefined)?.client;

  if (isRecord(client) && client.model !== undefined) {
    if (typeof client.model !== 'string' || client.model.trim() === '') {
      issues.push('client.model: must be a non-empty string such as "jev-1.13.0"');
    }
  }

  const targets: unknown = (config as { targets?: unknown } | null | undefined)?.targets;

  if (!isRecord(targets) || Object.keys(targets).length === 0) {
    issues.push('targets: must declare at least one target');
  } else {
    for (const [name, target] of Object.entries(targets)) {
      validateTarget(`targets.${name}`, target, issues);
    }
  }

  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }
}
