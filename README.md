[English](./README.md) | [日本語](./README.ja.md) | [简体中文](./README.zh.md) | [한국어](./README.ko.md)

# jev-spec

[![npm version](https://img.shields.io/npm/v/jev-spec.svg)](https://www.npmjs.com/package/jev-spec)
[![CI](https://img.shields.io/github/actions/workflow/status/nozomi-koborinai/jev-spec/ci.yml?branch=main&label=CI)](https://github.com/nozomi-koborinai/jev-spec/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![Bun Version](https://img.shields.io/badge/bun-%3E%3D1.2-black.svg)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

<p align="center"><img src="./assets/hero.png" alt="jev-spec - Specification-Driven Semantic Verification Engine" width="100%" /></p>

**Specification-Driven Semantic Verification Engine for AI Code & Specs powered by TypeSafe AI Jev.**

---

## Why jev-spec? Bridging the Semantic Gap

In Specification-Driven Development (SDD) and AI-assisted workflows (Cursor, agentic coding tools, GitHub Copilot), structural linters deterministically enforce markdown schemas, heading hierarchies, cross-references, and requirement IDs. However, static linters cannot bridge the **semantic gap**:

- *Does `src/auth/session.ts` truly satisfy the functional criteria stipulated in `REQ-AUTH-02`?*
- *Did the AI assistant silently introduce unrequested side effects, bypass headers, or undocumented endpoints?*
- *Is this pull request an actual feature-complete implementation or an optimistic stub with placeholder comments?*

### The Autoregressive LLM Trap: Free-Form Generation for Verification

Evaluating semantic compliance historically required prompting autoregressive generative language models with prompt engineering:

- **High Latency**: Sequential token-by-token generation takes **5 to 15 seconds** per file review.
- **Prohibitive Cost**: Autoregressive decoding burns **$0.05 to $0.20+** per file evaluation.
- **Non-Deterministic Drift**: Fragile prompt templates, hallucinated justifications, JSON parsing failures, and subjective variance across runs.
- **Workflow Friction**: Too slow for pre-commit git hooks, staged diff checks, or fast blocking CI gates.

### The Jev Advantage: Structured Decision Primitives over Free-Form Text Generation

In optical physics, a **collimator** takes a diffuse, scattered beam of light and narrows it into parallel, focused rays. `jev-spec` acts as a semantic collimator: taking the diffuse, high-entropy output of AI coding models and focusing it into mathematically calibrated, deterministic verification decisions.

Powered by **TypeSafe AI Jev**, `jev-spec` is built on structured decision primitives rather than token-by-token text generation:

- **Structured Decision Primitives**: Rather than generating free-form prose or JSON strings token-by-token, Jev directly predicts calibrated probability distributions over typed decision primitives (`noul`, `choice`, `score`) in a single forward pass over shared specification and implementation context.
- **Sub-400ms Verification**: Single forward-pass evaluation in **70ms to 400ms**.
- **Radical Cost Efficiency**: **$0.042 per million input tokens** (output tokens are free) — over 100x cheaper than generative review prompts.
- **Mathematical Calibration**: Evaluates typed decision primitives trained with Reinforcement Learning for Calibrated Decisions (RLCD). A predicted probability of 0.85 means the proposition is empirically true in 85% of cases.
- **Parallel Sampler**: Evaluates boolean propositions (`noul`), categorical distributions (`choice`), and ordinal rubrics (`score`) simultaneously in a single forward pass without sequential token decoding.
- **Deterministic Numerical Assertions**: Test semantic assertions (`minProbability`, `maxProbability`, `allowedChoices`, `minScore`) directly in your terminal, pre-commit hooks, or CI pipeline with standard exit codes.

| Capability | Autoregressive LLM Prompting | jev-spec + Jev (Decision Primitives) |
| :--- | :--- | :--- |
| **Execution Speed** | 5,000ms – 15,000ms per file | **70ms – 400ms** (single forward pass) |
| **Token Pricing** | ~$3.00 – $15.00 / MTok | **$0.042 / MTok** (output tokens free) |
| **Evaluation Mode** | Free-form token-by-token text/JSON generation | **Single forward pass over typed decision primitives** |
| **Output Type** | Unstructured prose or parsed JSON strings | **Calibrated probabilities & categorical distributions** |
| **Determinism** | Subjective reasoning & formatting drift | **Numerical thresholds (`minProbability: 0.85`)** |
| **Git Hooks & Fast CI** | Impractical (breaks developer flow) | **Instant (<100ms startup with Bun)** |

### Architecture Overview

```text
Specification (Markdown / MDX) ──┐
                                 ├─► [jev-spec Engine] ─► Jev System 1 ─► Calibrated Decisions & Assertions
Implementation (Code / Git Diff) ─┘   (Root Jail + Boundary Isolation)       (Pass / Fail in <400ms)
```

1. **Context Extraction**: Parses markdown specifications using `mdast` (filtering by heading, tag, or requirement ID) and extracts source files or staged git diff hunks.
2. **Security Isolation**: Enforces workspace root jails, symlink escape checks, git revision argument sanitization, and anti-prompt-injection boundary tagging.
3. **Parallel Forward Pass**: Transmits shared context and rubrics to the Jev decision engine in a single batch request.
4. **Assertion Evaluation**: Validates returned calibrated probabilities and scores against numerical thresholds, exiting with deterministic codes for CI/CD automation.

---

## Quickstart

Get up and running with `jev-spec` in three steps:

### 1. Install jev-spec

Install `jev-spec` as a development dependency using your package manager of choice:

```bash
# Bun (recommended for local developer loops)
bun add -d jev-spec

# npm
npm install -D jev-spec

# pnpm
pnpm add -D jev-spec
```

*Or run directly without local installation via `bunx jev-spec` or `npx jev-spec`.*

### 2. Configure Zones & Rubrics

Create `jev-spec.config.ts` in your repository root:

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
          'Stub: Empty function signatures or TODO comments',
          'Partial: Happy path implemented, error handling missing',
          'Feature Complete: Complete implementation meeting all criteria',
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

### 3. Run Semantic Verification

Set your API key and execute verification:

```bash
export TYPESAFE_AI_API_KEY="your-typesafe-api-key"

# Fast execution with Bun
bunx jev-spec check

# Or with Node.js npx
npx jev-spec check
```

*(Note: run `jev-spec check --mock`, or set `client: { mock: true }` in your config, for offline testing and local CI simulation without an API key. Mock results are placeholders and every report is labelled `MOCK MODE`.)*

---

## Configuration DSL Guide

`jev-spec` configurations use the `defineConfig(...)` helper for full TypeScript type inference and auto-completion.

Every configuration is validated before anything is sent to Jev. Assertion keys that match no rubric, options that do not fit the rubric type, unknown choice keys and out-of-range thresholds (for example `maxProbability: 15` instead of `0.15`) stop the run with exit code `2` instead of silently producing a check that can never fail. With `defineConfig(...)`, TypeScript reports the same mistakes in your editor.

### Core DSL Primitives

#### noul(question): NoulRubric

A **noul** is a calibrated boolean proposition evaluated in the range `[0, 1]`. Jev estimates the empirical probability that the statement is true given the specification context and implementation code.

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

- **Assertion Options**:
  - `minProbability?: number`: Minimum acceptable probability threshold (`[0, 1]`).
  - `maxProbability?: number`: Maximum tolerated probability threshold (`[0, 1]`).

#### choice(description, options): ChoiceRubric

A **choice** rubric represents a discrete categorical distribution across mutually exclusive options.

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

- **Assertion Options**:
  - `allowedChoices?: readonly T[]`: Permitted choice keys.
  - `blockedChoices?: readonly T[]`: Forbidden choice keys (fails if selected).
  - `minConfidence?: number`: Minimum required confidence score for the selected choice (`[0, 1]`).

#### score(description, levels): ScoreRubric

A **score** rubric maps evaluation onto an ordinal scale between 2 and 10 levels. Returns a continuous score, level probabilities, and confidence.

```typescript
rubrics: {
  implementationCompleteness: score('Implementation depth relative to specification', [
    'Stub: Function signatures with empty bodies or TODO comments',
    'Partial: Happy path implemented, error handling or edge cases missing',
    'Feature Complete: Happy path and error branches fully handled',
    'Production Ready: Complete implementation with validation and defensive bounds',
  ]),
},
assertions: {
  implementationCompleteness: {
    minScore: 2.0, // Minimum fractional level index (0 = Stub, 3 = Production Ready)
    minConfidence: 0.70,
  },
}
```

- **Assertion Options**:
  - `minScore?: number`: Minimum fractional score index.
  - `maxScore?: number`: Maximum fractional score index.
  - `minConfidence?: number`: Minimum confidence metric (`[0, 1]`).

### Zone Configuration Interface

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

`specFilter` keeps every section that satisfies all of the given criteria, together with its nested subsections, so details written under deeper headings stay part of the requirement. A filter that matches no section is treated as a configuration error (exit code `2`) rather than silently sending the whole document.

### CLI Usage Reference

#### Check All Zones

Run semantic verification across all zones declared in your configuration:

```bash
# Instant check via Bun
bunx jev-spec check

# Check via Node.js
npx jev-spec check
```

#### Targeted Zone Verification

Execute verification against a single zone:

```bash
bunx jev-spec check --zone auth
```

#### Git Diff Verification (Pre-commit Hooks & CI)

Verify semantic compliance against changed lines instead of entire source files:

```bash
# Verify against staged git changes (ideal for pre-commit git hooks)
bunx jev-spec check --staged

# Verify git diff against a branch range (ideal for pull request CI)
bunx jev-spec check --diff origin/main...HEAD
```

Zones whose `codePaths` match none of the changed files are reported as `SKIPPED`: they are not sent to Jev and do not affect the exit code, so a pre-commit hook never blocks a commit that does not touch a zone.

#### Offline Mock Mode, Help & Version

```bash
# Offline run without an API key (placeholder results, labelled MOCK MODE in every report)
npx jev-spec check --mock

# Usage and version (no configuration file required)
npx jev-spec --help
npx jev-spec --version
```

Unknown commands, unknown options, missing option values and unsupported `--format` values are rejected with exit code `2`.

#### Output Formats

```bash
# Formatted terminal report (default)
npx jev-spec check --format terminal

# Markdown report (ideal for GitHub Step Summaries and PR comments)
npx jev-spec check --format markdown --output jev-spec-report.md

# Machine-readable JSON output (for custom reporting pipelines)
npx jev-spec check --format json --output result.json
```

`--output` only accepts paths inside the project root. To publish the report to the GitHub Actions step summary (which lives outside the workspace), redirect stdout instead:

```bash
npx jev-spec check --format markdown >> "$GITHUB_STEP_SUMMARY"
```

#### CLI Exit Codes

- `0`: All zones and assertions passed.
- `1`: Verification failed (one or more assertions breached).
- `2`: Configuration or runtime error (missing file, invalid argument, missing API key).

---

## Dual Runtime Support Matrix

`jev-spec` provides first-class dual-runtime support across modern **Node.js** and **Bun**. Every pull request is validated against both runtimes across all supported versions in automated CI.

| Runtime | Supported Versions | Status | Best For | Typical Cold Start |
| :--- | :--- | :--- | :--- | :--- |
| **Bun** | `>= 1.2` (Latest) | Tier 1 / Supported | Ultra-fast pre-commit hooks, staged checks, local dev loops | **< 100ms** |
| **Node.js** | `>= 22.0.0` (LTS 22) | Tier 1 / Supported | Standard production CI/CD pipelines, containerized runners | ~350ms – 500ms |
| **Node.js** | `>= 24.0.0` (Current 24) | Tier 1 / Supported | Modern cutting-edge Node runtime environments | ~350ms – 500ms |

### Why Bun for Pre-Commit Hooks?

Because Jev evaluates decisions in **sub-second time (70ms – 400ms)**, runtime startup overhead represents the majority of wall-clock time in local developer workflows:

- **Instant Execution**: `bunx jev-spec check --staged` starts in **under 100ms** — more than 3x faster than traditional runner startups.
- **Zero-Friction Git Hooks**: Developers can run full semantic assertions on staged changes in under half a second combined.
- **Native TypeScript Execution**: Loads `jev-spec.config.ts` directly without transpilation overhead.

---

## Security & CI Best Practices

`jev-spec` is engineered for safe execution in automated CI/CD environments and developer workstations.

### CI Threat Model: Fork PRs & Secret Handling

> [!WARNING]
> **DO NOT** expose `TYPESAFE_AI_API_KEY` to untrusted external pull requests (`pull_request` event on public repositories)!

1. **Untrusted Code Risk**: In public repositories, pull requests can modify `jev-spec.config.ts`, specifications, or code. Executing untrusted code with access to sensitive credentials introduces secret exfiltration vectors.
2. **Recommended Defense-in-Depth Patterns**:
   - **Offline Mock Mode for Fork PRs**: Run PR checks using mock mode (`jev-spec check --mock`), validating configuration structure, spec parsing, and glob matching without exposing API credentials.
   - **Environment Protection**: For live verification on external PRs, use GitHub Actions Environment Approvals so maintainers review the diff before secrets are unlocked.
   - **Main Branch Verification**: Run live semantic verification on `push` to `main` and trusted internal release branches.

### Recommended GitHub Actions Workflow

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

      - name: Run jev-spec (Internal Pull Request / Changed Zones)
        if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
        env:
          TYPESAFE_AI_API_KEY: ${{ secrets.TYPESAFE_AI_API_KEY }}
        run: |
          npx jev-spec check \
            --diff origin/main...HEAD \
            --format markdown >> "$GITHUB_STEP_SUMMARY"

      - name: Run jev-spec (Push to Main / Full Verification)
        if: github.event_name == 'push'
        env:
          TYPESAFE_AI_API_KEY: ${{ secrets.TYPESAFE_AI_API_KEY }}
        run: npx jev-spec check --format markdown >> "$GITHUB_STEP_SUMMARY"

      - name: Run jev-spec (External Fork / Mock Mode)
        if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository
        run: |
          npx jev-spec check --mock \
            --diff origin/main...HEAD \
            --format terminal
```

The push step runs a full verification on purpose: on `main`, `origin/main...HEAD` is an empty range, so every zone would be skipped.

### Built-in Security Controls

`jev-spec` implements comprehensive defensive security controls (Hardening S-01 through S-05) protecting developer machines and CI runners:

| Security Control | Implementation Guarantee |
| :--- | :--- |
| **Path Traversal & Root Jail** | Workspace paths are strictly validated using realpath resolution (`assertInsideRoot()`). Absolute paths outside cwd, `..` directory traversal, and symlinks escaping the repository root are rejected. |
| **Git Revision Sanitization** | Arguments passed to `--diff` are validated against strict git revision patterns (`assertGitRevision()`). Rejects flags starting with `-` (blocking option injection like `--output`), terminates option parsing with `--end-of-options` before the revision range, and enforces a 15-second command timeout. |
| **Prompt Boundary Protection** | Untrusted specification and implementation contents are isolated within delimited tags (`<specification_context>` and `<untrusted_source_code>`) accompanied by strict anti-prompt-injection framing instructing Jev to disregard instructions embedded within source files. |
| **Base URL SSRF Protection** | By default, requests are routed exclusively to official TypeSafe AI endpoints (`https://api.typesafe.ai`). Custom API base URLs are blocked unless `allowCustomBaseUrl: true` is explicitly configured. |
| **Resource Bounds** | Prevents denial-of-service and runaway memory consumption by enforcing strict limits: max 500 files per scan, 2MB file size cap, and bounded character truncation per evaluation prompt. |

For detailed security disclosures and reporting policies, see [SECURITY.md](./SECURITY.md).

---

## Contributing & License

Contributions are welcome! Please ensure all tests and linter checks pass before submitting a pull request:

```bash
npm run check
npm test
```

Released under the [MIT License](./LICENSE).
