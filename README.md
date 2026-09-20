# jev-spec

[![npm version](https://img.shields.io/npm/v/jev-spec.svg)](https://www.npmjs.com/package/jev-spec)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![Bun Version](https://img.shields.io/badge/bun-%3E%3D1.2-black.svg)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**Specification-Driven Semantic Verification Engine for AI Code & Specs powered by TypeSafe AI Jev.**

---

## Why jev-spec?

In modern Specification-Driven Development (SDD) and AI-assisted workflows (Cursor, Claude Code, GitHub Copilot, Codex), structural linters like `contextlint` deterministically enforce markdown schemas, heading hierarchies, cross-references, and requirement IDs. However, static linters cannot bridge the **semantic gap**:

- *Does `src/auth/session.ts` truly satisfy the acceptance criteria stipulated in `REQ-AUTH-02`?*
- *Did the AI assistant silently introduce unrequested side effects, bypass headers, or undocumented endpoints?*
- *Is this pull request an actual feature-complete implementation or an optimistic stub?*

### The Problem with Generative LLMs (System 2)

Historically, evaluating semantic compliance required prompting slow, expensive generative Large Language Models (LLMs) such as GPT-4 or Claude 3.5 Sonnet:

- **Slow**: Sequential token generation takes **5 to 15 seconds** per review pass.
- **Costly**: Autoregressive decoding burns **$0.05 to $0.20+** per file review.
- **Non-Deterministic**: Susceptible to hallucinations, formatting variances, and subjective reasoning drift.
- **High Friction**: Too slow for pre-commit hooks, staged diff checks, or fast CI gates.

### The Jev Advantage: Non-Generative System 1 Decision Model

`jev-spec` is built from the ground up on **TypeSafe AI Jev**, the industry's first non-generative **System 1 decision model**:

- **Ultra-Fast & Sub-Second**: Single forward pass in **70ms to 400ms**.
- **Radical Cost Reduction**: **$0.042 per million input tokens** (output tokens are free), over 100x cheaper than generative review prompts.
- **Calibrated Verification**: Evaluates typed decision primitives trained with Reinforcement Learning for Calibrated Decisions (RLCD). A predicted probability of 0.85 means the proposition is empirically true in 85% of cases.
- **Parallel Sampler**: Simultaneously evaluates multiple boolean propositions (`noul`), discrete categorical distributions (`choice`), and ordinal rubrics (`score`) in a single forward pass over shared specification and implementation context.
- **Deterministic Assertions**: Run numerical assertions (`minProbability`, `maxProbability`, `allowedChoices`, `minScore`) directly in your terminal, pre-commit hooks, or CI pipeline.

```text
Specification (Markdown / MDX) ──┐
                                 ├─► [jev-spec Engine] ─► Jev System 1 ─► Calibrated Decisions & Assertions
Implementation (Code / Git Diff) ─┘   (Path Jail + Boundary Isolation)       (Pass / Fail in <400ms)
```

---

## Runtime Support Matrix

`jev-spec` offers first-class, dual-runtime support across both modern **Node.js** and **Bun**. Automated CI test suites validate full feature parity and test passing across both runtimes on every commit.

| Runtime | Supported Versions | Status | Best For | Typical Cold Start |
| :--- | :--- | :--- | :--- | :--- |
| **Bun** | `>= 1.2` (Latest) | Tier 1 / Supported | Ultra-fast pre-commit hooks, staged checks, local dev loops | **< 100ms** |
| **Node.js** | `>= 22.0.0` (LTS 22) | Tier 1 / Supported | Standard production CI/CD pipelines, containerized runners | ~350ms - 500ms |
| **Node.js** | `>= 24.0.0` (Current 24) | Tier 1 / Supported | Modern cutting-edge Node runtime environments | ~350ms - 500ms |

### Why Bun for Pre-Commit Hooks?

Because `jev-spec` evaluates non-generative decisions in **sub-second time (70ms - 400ms)**, the JavaScript runtime startup overhead often constitutes a significant fraction of total wall-clock time.

- **Instant Execution**: `bunx jev-spec check --staged` boots in **under 100ms** — more than 3x faster startup than standard `npx`.
- **Zero Friction Git Hooks**: Developers won't bypass git hooks that execute and verify semantic assertions in under half a second combined.
- **Native TypeScript Loading**: Direct loading of `jev-spec.config.ts` without transpilation lag.

---

## Installation

Install `jev-spec` as a development dependency using your preferred package manager:

### Bun

```bash
bun add -d jev-spec
```

### npm

```bash
npm install -D jev-spec
```

### pnpm

```bash
pnpm add -D jev-spec
```

### Direct Execution via `bunx` / `npx`

Run without local installation:

```bash
# Ultra-fast execution via Bun (recommended for local developer checks)
bunx jev-spec --help

# Execution via Node.js
npx jev-spec --help
```

---

## Quickstart

### 1. Initialize Configuration

Create `jev-spec.config.ts` in your project root:

```typescript
import { defineConfig, noul, choice, score } from 'jev-spec';

export default defineConfig({
  zones: {
    auth: {
      description: 'Authentication session token verification',
      specPath: 'docs/specs/auth-requirements.md',
      codePaths: ['src/auth/**/*.ts', '!src/auth/**/*.test.ts'],
      specFilter: {
        requirementPrefix: 'REQ-AUTH-',
      },
      rubrics: {
        satisfiesRequirements: noul(
          'Does the code satisfy functional criteria defined in REQ-AUTH-01 and REQ-AUTH-02?'
        ),
        introducesUnspecifiedBehavior: noul(
          'Does the implementation introduce undocumented endpoints, global state mutability, or unauthenticated bypasses?'
        ),
        securityPosture: choice('Security posture of session management', {
          secure: 'Proper signature validation and revocation checks present',
          insecure: 'Missing verification, weak crypto, or tokens logged',
        }),
        implementationCompleteness: score('Degree of completeness', [
          'Stub',
          'Basic',
          'Feature Complete',
        ]),
      },
      assertions: {
        satisfiesRequirements: { minProbability: 0.85 },
        introducesUnspecifiedBehavior: { maxProbability: 0.15 },
        securityPosture: { allowedChoices: ['secure'], minConfidence: 0.75 },
        implementationCompleteness: { minScore: 1.8 },
      },
    },
  },
});
```

### 2. Set Up API Key

Obtain an API key from [TypeSafe AI](https://typesafe.ai) and export it:

```bash
export TYPESAFE_AI_API_KEY="your-typesafe-api-key"
```

*(Alternatively, set `TYPESAFE_API_KEY` or pass `client: { mock: true }` for local offline testing).*

### 3. Run Verification

Run verification using `bunx` or `npx`:

```bash
# Ultra-fast sub-100ms cold start with Bun
bunx jev-spec check

# Or with Node.js npx
npx jev-spec check
```

---

## Configuration Guide (`jev-spec.config.ts`)

`jev-spec` configs export a `defineConfig(...)` declaration containing client options and one or more verification **zones**.

### Core DSL Primitives

#### `noul(question: string): NoulRubric`

A **noul** is a calibrated boolean proposition evaluated in $[0, 1]$. Jev estimates the empirical probability that the statement is true given the specification and code.

```typescript
rubrics: {
  implementsRateLimit: noul('Does the rate limiter enforce a 60 req/min bucket?'),
  hasBypassHeader: noul('Does the implementation permit any unauthenticated bypass header?'),
},
assertions: {
  implementsRateLimit: { minProbability: 0.85 },
  hasBypassHeader: { maxProbability: 0.10 },
}
```

- **Assertions**:
  - `minProbability?: number`: Minimum accepted probability threshold ($[0, 1]$).
  - `maxProbability?: number`: Maximum tolerated probability threshold ($[0, 1]$).

#### `choice<T extends string>(description: string, options: Record<T, string>): ChoiceRubric<T>`

A **choice** rubric represents a discrete categorical distribution over a set of mutually exclusive options.

```typescript
rubrics: {
  architecturePattern: choice('Architectural pattern applied', {
    hexagonal: 'Domain logic isolated with ports and adapters',
    layered: 'Classic controller-service-repository layered pattern',
    spaghetti: 'Tightly coupled concerns without distinct abstraction boundaries',
  }),
},
assertions: {
  architecturePattern: {
    allowedChoices: ['hexagonal', 'layered'],
    blockedChoices: ['spaghetti'],
    minConfidence: 0.80,
  },
}
```

- **Assertions**:
  - `allowedChoices?: readonly T[]`: List of acceptable selected choices.
  - `blockedChoices?: readonly T[]`: Disallowed choices (fails if chosen).
  - `minConfidence?: number`: Minimum prediction confidence for the chosen option ($[0, 1]$).

#### `score(description: string, levels: readonly string[]): ScoreRubric`

A **score** rubric maps evaluation onto an ordinal scale between 2 and 10 levels. Returns a continuous score, level probabilities, and confidence.

```typescript
rubrics: {
  implementationCompleteness: score('Implementation depth relative to specification', [
    'Stub: Function signatures with empty bodies or TODO comments',
    'Partial: Happy path implemented, error handling or edge cases missing',
    'Feature Complete: Happy path and error branches fully handled',
    'Production Ready: Complete implementation with logging, validation, and defensive bounds',
  ]),
},
assertions: {
  implementationCompleteness: {
    minScore: 2.0, // Minimum fractional level index (0 = Stub, 3 = Production Ready)
    minConfidence: 0.70,
  },
}
```

- **Assertions**:
  - `minScore?: number`: Minimum score index.
  - `maxScore?: number`: Maximum score index.
  - `minConfidence?: number`: Minimum confidence metric.

### Zone Definition Reference

```typescript
export interface ZoneConfig {
  /** Optional human-readable description */
  readonly description?: string;

  /** Relative path to markdown/MDX specification inside workspace */
  readonly specPath: string;

  /** Relative file paths or glob patterns for implementation files */
  readonly codePaths: readonly string[];

  /** Spec section filtering rules */
  readonly specFilter?: {
    readonly headings?: readonly string[];       // Filter by heading titles
    readonly requirementPrefix?: string;         // e.g. 'REQ-AUTH-' or 'AC-'
    readonly tags?: readonly string[];           // Filter by hashtag labels e.g. ['auth']
  };

  /** Declared Jev evaluation rubrics */
  readonly rubrics: Record<string, AnyRubric>;

  /** Assertions checked against Jev results */
  readonly assertions: AssertionMap<R>;
}
```

---

## CLI Usage

### Basic Check

Run semantic verification on all zones declared in your config:

```bash
# Using Bun (instant execution)
bunx jev-spec check

# Using Node.js
npx jev-spec check
```

### Zone Filtering

Target a specific zone:

```bash
bunx jev-spec check --zone auth
# or: npx jev-spec check --zone auth
```

### Git Diff Verification (Fast Feedback & CI)

Instead of feeding full files, verify only changed hunks:

```bash
# Verify against staged git changes (ideal for pre-commit hooks with Bun)
bunx jev-spec check --staged
# or: npx jev-spec check --staged

# Verify git diff against a branch range (ideal for PR CI)
bunx jev-spec check --diff origin/main...HEAD
# or: npx jev-spec check --diff origin/main...HEAD
```

### Output Formats

```bash
# Terminal report (default)
npx jev-spec check --format terminal

# Markdown summary (for PR comments / GitHub Step Summaries)
npx jev-spec check --format markdown --output jev-spec-report.md

# Machine-readable JSON output (for custom tooling)
npx jev-spec check --format json --output result.json
```

### CLI Exit Codes

- `0`: All zones and assertions passed.
- `1`: Verification failed (one or more assertions breached).
- `2`: Configuration or runtime error (missing file, invalid argument, missing API key).

---

## Security & CI Best Practices

`jev-spec` is designed for safety in local development and automated CI/CD pipelines.

### CI Threat Model: Fork PRs & Secret Handling

> [!WARNING]
> **DO NOT** expose `TYPESAFE_AI_API_KEY` directly to untrusted external pull requests (`pull_request` event on public repositories)!

1. **Untrusted Code & Configurations**:
   In public repositories, any contributor can submit a pull request modifying `jev-spec.config.ts`, specifications, or code. Executing attacker-controlled code with access to sensitive credentials introduces secret exfiltration risks.
2. **Safe CI Patterns**:
   - **Offline Mock in PRs**: Run PR checks using mock mode (`client.mock = true`), verifying configuration validity, spec parsing, and glob matching without exposing API credentials.
   - **Environment Protection**: For live verification on external PRs, use GitHub Actions Environment Approvals so maintainers review the diff before secrets are unlocked.
   - **Main Branch Verification**: Run live semantic verification on `push` to `main` or trusted internal release branches.

#### Recommended GitHub Actions Workflow

```yaml
name: Specification Semantic Gate

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  verify-specs:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install Dependencies
        run: npm ci

      - name: Run jev-spec (Internal / Main)
        if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository
        env:
          TYPESAFE_AI_API_KEY: ${{ secrets.TYPESAFE_AI_API_KEY }}
        run: |
          npx jev-spec check \
            --diff origin/main...HEAD \
            --format markdown \
            --output $GITHUB_STEP_SUMMARY

      - name: Run jev-spec (External Fork / Mock Mode)
        if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository
        run: |
          npx jev-spec check \
            --diff origin/main...HEAD \
            --format terminal
```

---

### Built-in Security Controls

`jev-spec` includes hardened controls protecting against common supply-chain and runner exploitation vectors (Security Hardening S-01 to S-05):

| Control | Description |
| :--- | :--- |
| **Path Traversal & Root Jail** | Workspace paths are strictly validated using realpath resolution (`assertInsideRoot()`). Absolute paths outside cwd, `..` directory traversal, and symlinks escaping the repository root are rejected. |
| **Git Diff Sanitization** | Arguments passed to `--diff` are validated against strict git revision patterns (`assertGitRevision()`). Rejects flags starting with `-` (blocking option injection like `--output`), isolates range parameters behind `--`, and enforces a 15-second command timeout. |
| **Prompt Boundary Protection** | Untrusted specification and implementation contents are isolated within delimited tags (`<specification_context>` and `<untrusted_source_code>`) accompanied by strict anti-prompt-injection framing instructing Jev to disregard instructions embedded within source files. |
| **Base URL SSRF Protection** | By default, requests are routed exclusively to official TypeSafe AI endpoints (`https://api.typesafe.ai`). Custom API base URLs are blocked unless `allowCustomBaseUrl: true` is explicitly configured. |
| **Resource Bounds** | Prevents denial-of-service and runaway memory consumption by enforcing strict limits: max 500 files per scan, 2MB file size cap, and bounded character truncation per evaluation prompt. |

For detailed security disclosures and reporting policies, see [SECURITY.md](./SECURITY.md).

---

## Contributing & License

Contributions are welcome! Please ensure all tests and linter checks pass before opening a PR:

```bash
npm run check
npm test
```

Released under the [MIT License](./LICENSE).
