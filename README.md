# jev-spec

[![npm version](https://img.shields.io/npm/v/jev-spec.svg)](https://www.npmjs.com/package/jev-spec)
[![CI](https://img.shields.io/github/actions/workflow/status/nozomi-koborinai/jev-spec/ci.yml?branch=main&label=CI)](https://github.com/nozomi-koborinai/jev-spec/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![Bun Version](https://img.shields.io/badge/bun-%3E%3D1.2-black.svg)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Sponsor](https://img.shields.io/github/sponsors/nozomi-koborinai)](https://github.com/sponsors/nozomi-koborinai)

<p align="center"><img src="./assets/hero.png" alt="jev-spec: catch spec drift on every commit" width="100%" /></p>

🌐 [日本語](README.ja.md) | [简体中文](README.zh.md) | [한국어](README.ko.md)

**Catch spec drift on every commit.** `jev-spec` checks your code against the requirements in your Markdown specification and fails the build when they drift apart. It asks [TypeSafe AI's Jev model](https://docs.typesafe.ai) one focused question per requirement, gets a probability back, and compares it with a threshold you set. That makes it small enough for a pre-commit hook and strict enough for a CI gate.

```text
$ npx jev-spec check

=== jev-spec Check Report ===

Target: auth [✖ FAILED]
  Spec files: docs/specs/auth.md
  Code files: src/auth/session.ts
  Model: jev-1.13.0
    ✔ REQ-AUTH-01: probability: 0.97
    ✖ REQ-AUTH-02: probability: 0.08
       └─ Violation: Probability 0.08 is below minimum threshold 0.85
    ✔ introducesUnspecifiedBehavior: probability: 0.03

Overall: ✖ CHECKS FAILED

$ echo $?
1
```

*Example report. The layout is what the CLI prints (timing and cost lines omitted); the probabilities are illustrative.*

`jev-spec` is an independent open-source project. It is not affiliated with or endorsed by TypeSafe AI. Please report problems with `jev-spec` in [this repository](https://github.com/nozomi-koborinai/jev-spec/issues), not to TypeSafe.

---

## Why jev-spec?

Linters and schema checks can tell you that `REQ-AUTH-02` exists, is well formed and is linked from the right place. They cannot tell you whether the code does what `REQ-AUTH-02` says. With AI-assisted development that gap widens, because the code changes faster than anyone rereads the specification:

- *Does `src/auth/session.ts` still satisfy `REQ-AUTH-02`?*
- *Did the assistant quietly add a bypass header or an endpoint that nobody specified?*
- *Is this pull request a complete implementation, or a stub with optimistic comments?*

You can put these questions to a general-purpose LLM in a prompt. Then you parse prose, the shape of the answer changes between runs, and you pay for every generated token. That is an awkward thing to gate a build on.

### What jev-spec does instead

1. **You write questions, not prompts.** Each requirement gets one yes/no question (`noul`). Categorical (`choice`) and ordinal (`score`) rubrics are available when a decision depends on them. They live in a typed `jev-spec.config.ts`.
2. **Jev answers with numbers.** Jev is a [System One model](https://docs.typesafe.ai/concepts/system-one): it does not generate text. It reads the specification and the code once and returns a probability for every question in the same request. TypeSafe trains it for [calibrated probabilities](https://docs.typesafe.ai/introduction/machine-learning-primer), which is what gives a threshold its meaning.
3. **Thresholds decide.** `minProbability: 0.85`, `maxProbability: 0.15`, `allowedChoices`, `minScore`: plain comparisons and standard exit codes (`0` passed, `1` failed, `2` broken setup).
4. **It is cheap enough for every commit.** Jev is priced on input tokens only, [$0.042 per million](https://docs.typesafe.ai/models), and output is free, so checking a target costs a fraction of a cent. Every report prints the estimate. TypeSafe publishes its own [speed and cost comparison](https://typesafe.ai) with general-purpose LLMs.

| | Prompting a general-purpose LLM | jev-spec with Jev |
| :--- | :--- | :--- |
| **What comes back** | Prose or JSON that you parse | A probability, a choice or a score per question |
| **How you gate on it** | Parse the text and hope the format holds | Numeric thresholds and exit codes |
| **What you pay for** | Input and generated output tokens | Input tokens only |
| **Where it fits** | Asynchronous review | Pre-commit hooks and blocking CI checks |

### Know the limits

- **A probability is not a proof.** jev-spec tells you that code has probably drifted from a requirement. It complements tests and review and replaces neither. Tune the thresholds on your own code before you trust them.
- **Keep targets small.** A target is sent in one request. Make it one domain, not the whole `src/` tree: Jev gets less accurate as unrelated content grows (see its [known limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13)).
- **Ask narrow, literal questions.** One behaviour per question, asked directly ("Is a token rejected when …?"), and say which part of the code you mean when two are alike. A requirement restated as a claim, multi-part questions, counting and stacked negations are answered less reliably.
- **English works best.** Jev's [primary training language is English](https://docs.typesafe.ai/models#language-support). Other languages, CJK scripts included, are accepted but less accurate, and TypeSafe advises testing on your own content first. With specs in another language, tune the thresholds on your own documents before you gate on them.
- **Markdown tables in a specification are not sent to the model yet.** Restate the rows in the question, or write the requirement as a list.
- **`--staged` and `--diff` choose the targets, not what the model sees.** A target none of whose files changed is skipped, and a touched target is checked in full. `--staged` reads what is staged, not the working tree. A change to a spec alone selects nothing, so keep a full run in CI.
- **Real checks need a [TypeSafe API key](https://console.typesafe.ai/keys).** `jev-spec check --dry-run` validates your setup without one.

### jev-spec checks itself

jev-spec has specs of its own and is checked against them. [`docs/specs/`](docs/specs) states the requirements, [`jev-spec.config.ts`](jev-spec.config.ts) pairs each group with the one to three files that implement it, and [`test/probes/`](test/probes) holds, for every requirement, a patch that breaks it on purpose. A rubric belongs in the gate only when it passes on the intact code and fails on the broken copy. [`docs/probe-results.md`](docs/probe-results.md) records the latest run: 22 of 22 probes caught with `jev-1.13.0`. A full check of the 8 targets and 22 rubrics takes under four seconds and costs an estimated $0.0006. The first run did not look like that: the questions, not the thresholds, were what had to change, and what we learned is in the header of the configuration.

### Architecture Overview

```text
Specification (Markdown) ─────────┐
                                  ├─► [jev-spec Engine] ─► Jev (System One) ─► Probabilities ─► Assertions
Implementation (Code / Git Diff) ─┘   (Root Jail + Boundary Isolation)                          (exit code 0 / 1 / 2)
```

1. **Context Extraction**: Parses markdown specifications using `mdast` (filtering by heading, tag, or requirement ID) and reads the source files of every target; in a diff run, only of the targets that the change touches.
2. **Security Isolation**: Enforces workspace root jails, symlink escape checks, git revision argument sanitization, and delimiting tags around the untrusted text sent to the model (a mitigation, not a guarantee).
3. **One Request per Target**: Sends the specification, the code and every rubric of a target to Jev in a single request.
4. **Assertion Evaluation**: Compares the returned probabilities and scores with your thresholds and exits with `0`, `1` or `2`.

---

## Quickstart

**AI-assisted setup.** For Claude Code, Cursor, Codex, Gemini CLI, GitHub Copilot and any other [Agent Skills](https://agentskills.io)-compatible client (requires GitHub CLI v2.90+):

```bash
gh skill install nozomi-koborinai/jev-spec jev-spec-init
gh skill install nozomi-koborinai/jev-spec jev-spec-fix
```

Then ask your agent to "set up jev-spec". `jev-spec-init` maps your specifications to code, writes one focused question per requirement, validates the wiring offline and reports which requirements are not covered. `jev-spec-fix` works through a failing check and reports what was and was not verified.

**Manual setup.** Get up and running with `jev-spec` in three steps:

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

### 2. Configure Targets & Rubrics

A **target** pairs one part of your spec with the code that implements it. It has its own rubrics and assertions and is checked as a unit.

Create `jev-spec.config.ts` in your repository root:

```typescript
import { defineConfig, noul, choice, score } from 'jev-spec';

export default defineConfig({
  targets: {
    auth: {
      description: 'Authentication session token verification',
      specPath: 'docs/specs/auth-requirements.md',
      codePaths: ['src/auth/**/*.ts', '!src/auth/**/*.test.ts'],
      specFilter: {
        requirementPrefix: 'REQ-AUTH-',
      },
      rubrics: {
        'REQ-AUTH-01': noul(
          'Is the signature of a session token checked before access to a protected resource is granted?'
        ),
        'REQ-AUTH-02': noul('Is a token rejected when its ID is on the revocation list?'),
        introducesUnspecifiedBehavior: noul(
          'Does the code add a way to reach a protected resource that the spec does not describe?'
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
        'REQ-AUTH-01': { minProbability: 0.85 },
        'REQ-AUTH-02': { minProbability: 0.85 },
        introducesUnspecifiedBehavior: { maxProbability: 0.15 },
        securityPosture: { allowedChoices: ['secure'], minConfidence: 0.75 },
        implementationCompleteness: { minScore: 1.8 },
      },
    },
  },
});
```

Name each rubric after the requirement it checks, and ask one direct, literal question about what the code must do. The name of a rubric is never sent to the model, and the report prints it, so a failure names its requirement. Keep the ID out of the question: in [our own measurements](docs/probe-results.md), "Does the code satisfy REQ-AUTH-01: …?" was answered "yes" for code that had been broken on purpose, and the same question asked directly was not. A question that joins several requirements cannot tell you which one failed.

### 3. Run the Check

Create an API key in the [TypeSafe console](https://console.typesafe.ai/keys), set it, and run the check:

```bash
export TYPESAFE_AI_API_KEY="your-typesafe-api-key"

# Fast execution with Bun
bunx jev-spec check

# Or with Node.js npx
npx jev-spec check
```

*(No API key yet? `jev-spec check --dry-run` validates the configuration, spec parsing and file matching without evaluating anything. `--mock` runs the offline mock evaluator instead: its results are placeholders, and every report is labelled `MOCK MODE`.)*

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

### Target Configuration Interface

```typescript
export interface TargetConfig {
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

### Pinning the Model

```typescript
export default defineConfig({
  client: { model: 'jev-1.13.0' },
  targets: {
    // …
  },
});
```

Without `client.model`, jev-spec asks `jev-latest`, an alias that TypeSafe moves to a newer model with every release, so a result can change without any change in your repository. Once you have tuned your thresholds, pin the [versioned model ID](https://docs.typesafe.ai/models) they were tuned against (`TYPESAFE_DEFAULT_MODEL` works too). Every report prints the model that answered (`Model: jev-1.13.0`), and `--dry-run` warns while the model is not pinned.

### CLI Usage Reference

#### Check All Targets

Check every target declared in your configuration:

```bash
# Check via Bun
bunx jev-spec check

# Check via Node.js
npx jev-spec check
```

#### Check a Single Target

Check one target by name:

```bash
bunx jev-spec check --target auth
```

#### Diff Runs (Pre-commit Hooks & CI)

Check only the targets whose code changed. Each of them is checked in full:

```bash
# Check the targets that the staged changes touch (ideal for pre-commit git hooks)
bunx jev-spec check --staged

# Check the targets that a branch range touches (ideal for pull request CI)
bunx jev-spec check --diff origin/main...HEAD
```

Targets whose `codePaths` match none of the changed files are reported as `SKIPPED`: they are not sent to Jev and do not affect the exit code, so a pre-commit hook never blocks a commit that does not touch a target.

#### Dry Run, Mock Mode, Help & Version

```bash
# Validate the setup: config, spec parsing, file matching. Evaluates nothing, needs no API key
npx jev-spec check --dry-run

# Offline mock evaluator (placeholder results, labelled MOCK MODE in every report)
npx jev-spec check --mock

# Usage and version (no configuration file required)
npx jev-spec --help
npx jev-spec --version
```

A dry run prints, for every target, the specification sections and requirement IDs it found, the code files it matched, the rubrics it would ask and the estimated cost. It also warns about requirement IDs that no rubric mentions, `codePaths` that match no file and a code context that exceeds the size budget. It exits with `0` when the setup is valid and `2` when it is not; it never exits with `1`, because nothing is checked.

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

- `0`: All targets and assertions passed.
- `1`: A check failed (one or more assertions violated).
- `2`: Configuration or runtime error (missing file, invalid argument, missing API key).

---

## Dual Runtime Support Matrix

`jev-spec` provides first-class dual-runtime support across modern **Node.js** and **Bun**. Every pull request is validated against both runtimes across all supported versions in automated CI.

| Runtime | Supported Versions | Status | Best For |
| :--- | :--- | :--- | :--- |
| **Bun** | `>= 1.2` (Latest) | Tier 1 / Supported | Pre-commit hooks, local development loops |
| **Node.js** | `>= 22.0.0` (LTS 22) | Tier 1 / Supported | CI/CD pipelines, containerized runners |
| **Node.js** | `>= 24.0.0` (Current 24) | Tier 1 / Supported | Current Node runtime environments |

### Which runtime for a pre-commit hook?

Either. Measured on the maintainer's laptop against this repository (Node 22.23, Bun 1.4): the CLI starts in about 0.1 s on Node and about 0.05 s on Bun, and a dry run of all 8 targets takes 0.15 s and 0.08 s. A live check of one target takes 0.3 to 0.9 s, so the request to the model, not the runtime, decides how long a hook takes:

- **What a hook costs**: `jev-spec check --staged` checks only the targets that the commit touches, each in one request. A commit that touches no target sends nothing and needs no API key.
- **`bunx` runs Node by default**: the CLI has a `#!/usr/bin/env node` shebang, and `bunx jev-spec` honours it. Use `bunx --bun jev-spec` to run it on Bun.
- **TypeScript configuration**: `jev-spec.config.ts` is loaded directly on both runtimes.

---

## Security & CI Best Practices

`jev-spec` is engineered for safe execution in automated CI/CD environments and developer workstations.

### CI Threat Model: Fork PRs & Secret Handling

> [!WARNING]
> **DO NOT** expose `TYPESAFE_AI_API_KEY` to untrusted external pull requests (`pull_request` event on public repositories)!

1. **Untrusted Code Risk**: In public repositories, pull requests can modify `jev-spec.config.ts`, specifications, or code. Executing untrusted code with access to sensitive credentials introduces secret exfiltration vectors.
2. **Recommended Defense-in-Depth Patterns**:
   - **Dry Run for Fork PRs**: Run PR checks as a dry run (`jev-spec check --dry-run`), validating configuration structure, spec parsing, and glob matching without exposing API credentials.
   - **Environment Protection**: For live checks on external PRs, use GitHub Actions Environment Approvals so maintainers review the diff before secrets are unlocked.
   - **Main Branch Checks**: Run live checks on `push` to `main` and trusted internal release branches.

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
  check-specs:
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

      - name: Run jev-spec (Internal Pull Request / Changed Targets)
        if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
        env:
          TYPESAFE_AI_API_KEY: ${{ secrets.TYPESAFE_AI_API_KEY }}
        run: |
          npx jev-spec check \
            --diff origin/main...HEAD \
            --format markdown >> "$GITHUB_STEP_SUMMARY"

      - name: Run jev-spec (Push to Main / Full Run)
        if: github.event_name == 'push'
        env:
          TYPESAFE_AI_API_KEY: ${{ secrets.TYPESAFE_AI_API_KEY }}
        run: npx jev-spec check --format markdown >> "$GITHUB_STEP_SUMMARY"

      - name: Run jev-spec (External Fork / Dry Run, No Secrets)
        if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository
        run: npx jev-spec check --dry-run
```

The push step is a full run on purpose: on `main`, `origin/main...HEAD` is an empty range, so every target would be skipped.

### Built-in Security Controls

`jev-spec` implements comprehensive defensive security controls (Hardening S-01 through S-05) protecting developer machines and CI runners:

| Security Control | What It Does |
| :--- | :--- |
| **Path Traversal & Root Jail** | Workspace paths are strictly validated using realpath resolution (`assertInsideRoot()`). Absolute paths outside cwd, `..` directory traversal, and symlinks escaping the repository root are rejected. |
| **Git Revision Sanitization** | Arguments passed to `--diff` are validated against strict git revision patterns (`assertGitRevision()`). Rejects flags starting with `-` (blocking option injection like `--output`), terminates option parsing with `--end-of-options` before the revision range, and enforces a 15-second command timeout. |
| **Prompt Boundaries (best effort)** | The specification and the code are sent in separate fields, inside delimiting tags (`<specification_context>` and `<untrusted_source_code>`), with a note that asks the model to ignore instructions embedded in them. This is a mitigation, not a guarantee: TypeSafe documents that content written to steer the model, including text that argues for its own classification, [can move the answer](https://docs.typesafe.ai/model-jaggedness/jev-1.13#adversarial-content). A comment that claims compliance is such text, so treat a pass on code you do not trust as weak evidence. |
| **Base URL SSRF Protection** | By default, requests are routed exclusively to official TypeSafe AI endpoints (`https://api.typesafe.ai`). Custom API base URLs are blocked unless `allowCustomBaseUrl: true` is explicitly configured. |
| **Resource Bounds** | Prevents denial-of-service and runaway memory consumption by enforcing strict limits: max 500 files per scan, 2MB file size cap, and bounded character truncation per evaluation prompt. |

For detailed security disclosures and reporting policies, see [SECURITY.md](./SECURITY.md).

---

## Contributing & License

Contributions are welcome! Please ensure all tests and linter checks pass before submitting a pull request:

```bash
npm run check      # Biome (lint + format check), typecheck and tests
npm run lint:fix   # apply Biome formatting and safe lint fixes
```

Released under the [MIT License](./LICENSE).

Support ongoing work on jev-spec through [GitHub Sponsors](https://github.com/sponsors/nozomi-koborinai).
