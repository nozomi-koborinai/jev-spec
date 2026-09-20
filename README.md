# jev-spec

**Specification-Driven Semantic Verification Engine for AI Code & Specs — powered by [TypeSafe AI Jev](https://typesafe.ai).**

> *Stop asking LLMs to rewrite your code. Start asking Jev whether your code satisfies your spec.*

---

## Why jev-spec?

Traditional spec verification leans on slow, generative LLMs: rewrite the diff, argue in prose, hope the model noticed REQ-AUTH-02. That is **System 2** work — expensive, non-deterministic, and hard to gate in CI.

**jev-spec** uses **TypeSafe AI Jev** — a calibrated decision engine — for **System 1** semantic checks:

| | Generative LLM review | jev-spec + Jev |
| --- | --- | --- |
| Output | Free-form text | Calibrated probabilities, categorical choices, ordinal scores |
| Speed | Seconds to minutes | Sub-second per rubric |
| CI gate | Fragile prompt parsing | Typed assertions (`minProbability`, `allowedChoices`, `minScore`) |
| Drift | Prompt/version sensitive | Rubric + spec slice + code context |
| Cost model | Token-heavy generation | Decision-only inference |

Pair markdown specs with source code, define rubrics in TypeScript, and run `jev-spec check` locally or in GitHub Actions — the same way you run ESLint or typecheck.

---

## Quickstart

```bash
npm i -D jev-spec
```

Create `jev-spec.config.ts` at your project root (see [Configuration](#configuration)), then:

```bash
npx jev-spec check
```

Verify only staged changes:

```bash
npx jev-spec check --staged
```

Export a JSON report for downstream tooling:

```bash
npx jev-spec check --format json --output jev-spec-report.json
```

Set `TYPESAFE_AI_API_KEY` (or configure `client.apiKey` in config) for live Jev evaluation. Use `client: { mock: true }` in tests and local dry-runs.

---

## Configuration

Zones map a **spec file**, **code paths**, **rubrics**, and **assertions**. Rubrics use Jev's three primitive decision types:

- **`noul`** — boolean proposition with calibrated probability in `[0, 1]`
- **`choice`** — categorical distribution over declared options
- **`score`** — ordinal rubric with 2–10 levels

```typescript
// jev-spec.config.ts
import { defineConfig, noul, choice, score } from 'jev-spec';

export default defineConfig({
  client: {
    // apiKey: process.env.TYPESAFE_AI_API_KEY,
  },
  zones: {
    auth: {
      description: 'Authentication session token verification',
      specPath: 'docs/specs/auth-requirements.md',
      codePaths: ['src/auth/**/*.ts'],
      specFilter: {
        requirementPrefix: 'REQ-AUTH-',
      },
      rubrics: {
        satisfiesRequirements: noul(
          'Does the code satisfy functional criteria in REQ-AUTH-01 and REQ-AUTH-02?'
        ),
        introducesUnspecifiedBehavior: noul(
          'Does the implementation introduce undocumented endpoints or behavior?'
        ),
        securityPosture: choice('Security posture of session management', {
          secure: 'Proper signature validation and revocation checks present',
          insecure: 'Missing verification or tokens logged',
        }),
        implementationCompleteness: score('Degree of completeness', [
          'Stub',
          'Basic',
          'Feature Complete',
        ]),
      },
      assertions: {
        satisfiesRequirements: { minProbability: 0.80 },
        introducesUnspecifiedBehavior: { maxProbability: 0.15 },
        securityPosture: { allowedChoices: ['secure'], minConfidence: 0.70 },
        implementationCompleteness: { minScore: 1.5 },
      },
    },
  },
});
```

### CLI options

```
jev-spec check [options]

  --config, -c   Path to config file (default: jev-spec.config.ts)
  --zone, -z     Run a single zone by name
  --staged       Limit code context to git staged changes
  --diff <range> Limit code context to a git diff range (default: HEAD)
  --format, -f   terminal | markdown | json
  --output, -o   Write report to file
```

Exit codes: `0` pass, `1` assertion failure, `2` configuration or runtime error.

---

## GitHub Actions

```yaml
name: Spec verification

on:
  pull_request:
    branches: [main]

jobs:
  jev-spec:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Verify specs against code
        env:
          TYPESAFE_AI_API_KEY: ${{ secrets.TYPESAFE_AI_API_KEY }}
        run: npx jev-spec check --format markdown --output jev-spec-report.md

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: jev-spec-report
          path: jev-spec-report.md
```

---

## How it works

1. **Parse** — Markdown specs are parsed (GFM) and sliced by headings, requirement prefixes, or tags.
2. **Extract** — Code context is gathered from globs, full files, or git diffs (`--staged` / `--diff`).
3. **Evaluate** — Each rubric is sent to Jev with spec + code context; Jev returns calibrated decisions.
4. **Assert** — Typed thresholds gate pass/fail for CI.

---

## Development

Requires Node.js 20+.

```bash
git clone https://github.com/nozomi-koborinai/jev-spec.git
cd jev-spec
npm ci
npm run typecheck
npm test
npm run build
```

---

## License

MIT © 2026 [Nozomi Koborinai](https://github.com/nozomi-koborinai)
