import {
  type Questions,
  choice as sdkChoice,
  noul as sdkNoul,
  score as sdkScore,
  TypeSafeClient,
} from '@typesafe-ai/sdk';
import type {
  AnyRubric,
  AnyRubricResult,
  ChoiceRubric,
  JevClientConfig,
  NoulRubric,
  ScoreRubric,
} from '../types.js';
import { buildSecureEvaluationState } from './prompt-security.js';

export interface EvaluationInput {
  readonly specContext: string;
  readonly codeContext: string;
  readonly rubrics: Record<string, AnyRubric>;
}

export interface EvaluationOutput {
  readonly answers: Record<string, AnyRubricResult>;
  /** Versioned ID of the model that answered. Absent when no model was involved (mock). */
  readonly model?: string;
}

export interface JevEvaluator {
  evaluate(input: EvaluationInput): Promise<EvaluationOutput>;
}

/** The part of the TypeSafe client that the live evaluator uses; a test can supply its own. */
export interface SystemOneClient {
  systemOne(request: {
    state: unknown;
    questions: Questions;
    model?: string;
  }): PromiseLike<{ readonly model: string; readonly answers: Record<string, unknown> }>;
}

export interface EvaluationUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export class JevSpecConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JevSpecConfigurationError';
  }
}

const MISSING_API_KEY_MESSAGE =
  'API key is required. Set TYPESAFE_AI_API_KEY (or TYPESAFE_API_KEY) environment variable, or configure client.apiKey in jev-spec.config.';

const DEFAULT_BASE_URL = 'https://api.typesafe.ai';
const DEFAULT_MODEL = 'jev-latest';

/**
 * Resolves API key from config or environment variables.
 */
export function resolveApiKey(config?: JevClientConfig): string | undefined {
  if (config?.apiKey?.trim()) {
    return config.apiKey.trim();
  }
  if (process.env.TYPESAFE_AI_API_KEY?.trim()) {
    return process.env.TYPESAFE_AI_API_KEY.trim();
  }
  if (process.env.TYPESAFE_API_KEY?.trim()) {
    return process.env.TYPESAFE_API_KEY.trim();
  }
  return undefined;
}

/**
 * Resolves the model name the same way the SDK does: configuration, then
 * `TYPESAFE_DEFAULT_MODEL`, then the alias `jev-latest`.
 */
export function resolveModel(config?: JevClientConfig): string {
  return config?.model?.trim() || process.env.TYPESAFE_DEFAULT_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * True for a name that TypeSafe moves to a newer model with a release (`jev-latest`,
 * `jev-preview`). Thresholds tuned against an alias can stop holding without any change in
 * the repository.
 */
export function isModelAlias(model: string): boolean {
  return /-(latest|preview)$/.test(model);
}

/**
 * Resolves the API base URL, blocking custom endpoints unless explicitly allowed.
 */
export function resolveBaseUrl(config?: JevClientConfig): string {
  const envBaseUrl = process.env.TYPESAFE_AI_BASE_URL?.trim();
  const configBaseUrl = config?.baseUrl?.trim();
  const requested = configBaseUrl || envBaseUrl;

  if (!requested || requested === DEFAULT_BASE_URL) {
    return DEFAULT_BASE_URL;
  }

  if (!config?.allowCustomBaseUrl) {
    throw new JevSpecConfigurationError(
      `Custom baseUrl "${requested}" is blocked. Set client.allowCustomBaseUrl: true to opt in.`
    );
  }

  return requested;
}

/**
 * Deterministic Mock Evaluator used for testing and offline development.
 */
export class MockJevEvaluator implements JevEvaluator {
  async evaluate(input: EvaluationInput): Promise<EvaluationOutput> {
    const results: Record<string, AnyRubricResult> = {};

    for (const [key, rubric] of Object.entries(input.rubrics)) {
      if (rubric.type === 'noul') {
        results[key] = this.evaluateNoul(rubric, input);
      } else if (rubric.type === 'choice') {
        results[key] = this.evaluateChoice(rubric, input);
      } else if (rubric.type === 'score') {
        results[key] = this.evaluateScore(rubric, input);
      }
    }

    return { answers: results };
  }

  private evaluateNoul(rubric: NoulRubric, input: EvaluationInput) {
    const q = rubric.question.toLowerCase();
    if (
      q.includes('unspecified') ||
      q.includes('side effect') ||
      q.includes('drift') ||
      q.includes('undocumented')
    ) {
      const hasBypass =
        input.codeContext.includes('bypass') || input.codeContext.includes('secret-dev-override');
      return {
        type: 'noul' as const,
        probability: hasBypass ? 0.91 : 0.04,
      };
    }
    if (q.includes('satisfy') || q.includes('implement')) {
      const isMeaningful = input.codeContext.length > 50 && !input.codeContext.includes('TODO');
      return {
        type: 'noul' as const,
        probability: isMeaningful ? 0.94 : 0.45,
      };
    }
    return {
      type: 'noul' as const,
      probability: 0.88,
    };
  }

  private evaluateChoice<T extends string>(rubric: ChoiceRubric<T>, _input: EvaluationInput) {
    const keys = Object.keys(rubric.options) as T[];
    const selected = keys[0];
    const distribution = {} as Record<T, number>;
    for (const k of keys) {
      distribution[k] = k === selected ? 0.9 : 0.1 / (keys.length - 1 || 1);
    }
    return {
      type: 'choice' as const,
      choice: selected,
      confidence: 0.9,
      distribution,
    };
  }

  private evaluateScore(rubric: ScoreRubric, input: EvaluationInput) {
    const maxScore = rubric.levels.length - 1;
    const isComplete = input.codeContext.length > 80;
    const targetScore = isComplete ? Math.max(1, maxScore - 0.5) : 1.0;
    const levelIdx = Math.min(Math.floor(targetScore), rubric.levels.length - 1);

    return {
      type: 'score' as const,
      score: targetScore,
      maxScore,
      confidence: 0.92,
      selectedLevel: rubric.levels[levelIdx],
      levelProbabilities: rubric.levels.map((_, i) => (i === levelIdx ? 0.85 : 0.05)),
    };
  }
}

/**
 * Live evaluator backed by @typesafe-ai/sdk systemOne parallel question API.
 */
export class LiveJevEvaluator implements JevEvaluator {
  private readonly client: SystemOneClient;
  private readonly model: string;

  constructor(config?: JevClientConfig, client?: SystemOneClient) {
    this.model = resolveModel(config);
    this.client =
      client ??
      new TypeSafeClient({
        apiKey: resolveApiKey(config),
        baseURL: resolveBaseUrl(config),
        timeout: config?.timeoutMs ?? 10_000,
      });
  }

  async evaluate(input: EvaluationInput): Promise<EvaluationOutput> {
    const questions = this.buildQuestions(input.rubrics);
    const secureState = buildSecureEvaluationState(input.specContext, input.codeContext);
    const response = await this.client.systemOne({
      state: secureState,
      questions,
      model: this.model,
    });

    return { answers: this.mapAnswers(input.rubrics, response.answers), model: response.model };
  }

  private buildQuestions(rubrics: Record<string, AnyRubric>): Questions {
    const questions: Questions = {};

    for (const [name, rubric] of Object.entries(rubrics)) {
      if (rubric.type === 'noul') {
        questions[name] = sdkNoul(rubric.question);
      } else if (rubric.type === 'choice') {
        questions[name] = sdkChoice(rubric.description, rubric.options);
      } else if (rubric.type === 'score') {
        questions[name] = sdkScore(
          rubric.description,
          rubric.levels as [string, string, ...string[]]
        );
      }
    }

    return questions;
  }

  private mapAnswers(
    rubrics: Record<string, AnyRubric>,
    answers: Record<string, unknown>
  ): Record<string, AnyRubricResult> {
    const mapped: Record<string, AnyRubricResult> = {};

    for (const [name, rubric] of Object.entries(rubrics)) {
      const answer = answers[name] as Record<string, unknown> | undefined;
      if (!answer) {
        continue;
      }

      if (rubric.type === 'noul' && answer.type === 'noul') {
        mapped[name] = {
          type: 'noul',
          probability: Number(answer.noul),
        };
      } else if (rubric.type === 'choice' && answer.type === 'choice') {
        const distribution = (answer.probabilities ?? {}) as Record<string, number>;
        mapped[name] = {
          type: 'choice',
          choice: String(answer.choice),
          confidence: Number(answer.confidence),
          distribution,
        };
      } else if (rubric.type === 'score' && answer.type === 'score') {
        const levelProbabilities = Object.values(
          (answer.probabilities ?? {}) as Record<string, number>
        );
        const legend = (answer.legend ?? {}) as Record<string, string>;
        const score = Number(answer.score);
        const selectedLevel =
          legend[String(Math.round(score))] ??
          rubric.levels[Math.min(Math.round(score), rubric.levels.length - 1)];

        mapped[name] = {
          type: 'score',
          score,
          maxScore: rubric.levels.length - 1,
          confidence: Number(answer.confidence),
          selectedLevel,
          levelProbabilities,
        };
      }
    }

    return mapped;
  }
}

/**
 * Creates an appropriate evaluator based on configuration.
 * Requires an API key unless mock mode is explicitly enabled.
 */
export function createJevEvaluator(config?: JevClientConfig): JevEvaluator {
  if (config?.mock) {
    return new MockJevEvaluator();
  }

  const apiKey = resolveApiKey(config);
  if (!apiKey) {
    throw new JevSpecConfigurationError(MISSING_API_KEY_MESSAGE);
  }

  return new LiveJevEvaluator(config);
}
