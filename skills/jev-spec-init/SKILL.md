---
name: jev-spec-init
description: Set up jev-spec in a repository so that source code is verified against its Markdown specifications. Use this skill whenever the user wants to install, initialize or configure jev-spec, or asks to "check the code against the spec", "verify the implementation matches the requirements", "gate AI-written code on the spec", or to add a spec check to CI or a pre-commit hook, even if they never mention jev-spec by name. Also use it to extend an existing jev-spec setup with new targets or rubrics.
license: MIT
compatibility: Requires Node.js 22+ (or Bun 1.2+) and npm, pnpm, yarn or bun to install the jev-spec package. Live verification needs a TypeSafe AI API key and network access; the setup itself can be validated offline.
metadata:
  homepage: https://github.com/nozomi-koborinai/jev-spec
  source: https://github.com/nozomi-koborinai/jev-spec
---

# jev-spec-init

Set up [jev-spec](https://github.com/nozomi-koborinai/jev-spec): a CLI that sends a specification and the code that implements it to TypeSafe AI's Jev model, gets calibrated probabilities back, and fails with exit code 1 when an assertion is breached. The goal is a setup whose **questions are good**: installing the package takes a minute, writing rubrics that a model can answer reliably is the actual work.

> **Language note**: Respond to the user in the language they are writing in. The English templates below are references; translate them at runtime. Keep rubric questions in the language of the specification.

## When to use this skill

- The user asks to set up, install, init or configure jev-spec, or to add targets or rubrics to an existing setup
- The user wants code checked against requirements, specs, acceptance criteria or a PRD, in CI or before commits, and the requirements live in Markdown
- The repo follows spec-driven development (Spec Kit, Kiro, cc-sdd, OpenSpec or a home-grown `docs/specs/`)

Not for fixing a failing check: use `jev-spec-fix`.

## Steps

### 1. Detect an existing setup

Look for `jev-spec.config.ts`, `jev-spec.config.js` or `jev-spec.config.mjs` at the repo root. If one exists, ask: `(overwrite)`, `(add)` targets and rubrics for uncovered requirements, or `(skip)`. Never rewrite a tuned config silently: its thresholds may have been calibrated.

### 2. Install

If `jev-spec` is already a dependency, keep it and check the version: this skill writes `targets`, which needs jev-spec 0.3.0 or later. On those versions `npx jev-spec --help` lists `--target`; if it lists `--zone` instead, upgrade the package before going on. Otherwise pick the package manager from the lockfile (`bun.lock` → bun, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, otherwise npm) and install `jev-spec` as a dev dependency. Then run `npx jev-spec --version` and `npx jev-spec --help`. The help output is the source of truth for flags; do not rely on memory.

### 3. Map specifications to code

1. Find the specification files. Do not assume `docs/specs/`: also look at `specs/`, `.kiro/specs/*/requirements.md`, `requirements/`, `docs/requirements/`.
2. List every requirement ID (`REQ-…`, `AC-…`, or the repo's own scheme) with its one-line meaning.
3. Propose **one target per specification file or domain**: `specPath` (a single file), `codePaths` (globs, tests excluded with `!**/*.test.ts`), and `specFilter.requirementPrefix` when one file holds several domains.
4. Show the mapping and let the user confirm it before writing anything.

Keep targets small. Everything in a target is sent in one request (at most 500 files, 2 MB per file, about 120,000 characters of code), and the model's accuracy drops as unrelated content grows. A target that covers the whole `src/` tree is a bug.

### 4. Write the rubrics

This is the part that decides whether the gate is worth anything.

- **Name every rubric after the requirement it checks**: `'REQ-AUTH-02': noul('…')`. The name is never sent to the model. The dry run uses it to tell which requirements are covered, and the report prints it, so a failure names its requirement. Most requirements are one criterion and get one rubric. A requirement that lists several (bullets, or rows of a table) gets one rubric per criterion: `'REQ-AUTH-01 signature'`, `'REQ-AUTH-01 expiry'`.
- **Ask one direct, literal question about what the code must do**, asserted with `minProbability`: `'Is a token rejected when its ID is on the revocation list, even when its signature is valid?'`. The model reads literally and takes a restated requirement for a claim. In jev-spec's own measurements, `'Does the code satisfy REQ-X: <requirement>?'` was answered "yes" for deliberately broken code, and the same question asked directly was not. So: the interrogative, one behaviour, and the requirement ID left out of the question.
- **Take what the question demands from the specification, and only its vocabulary from the code.** Read the requirement and decide what must be true. Then look at the code to learn what to call the part you mean ("the function that loads a session"): a question that points at a place separates right from wrong far better than one about "the code". A question that demands today's technique (`expiresAt <= Date.now()`, "uses `Math.round` with an epsilon") checks that the code still looks like today's code, not that it meets the requirement.
- **Never join requirements** ("…REQ-AUTH-01 and REQ-AUTH-02?"). A joined question cannot say which one failed, and multi-part judgments are measurably less reliable.
- **One `noul` per target for drift**: `'Does the code add behavior that the specification does not describe, such as …?'` with two or three examples that fit the domain. Its threshold is a `maxProbability`. Like every threshold it goes into `assertions`: `noul()` takes the question and nothing else.
- **Match the assertion to the answer that correct code gives.** A question that correct code answers "yes" takes `minProbability`; a question that correct code answers "no" takes `maxProbability`. Getting this backwards fails correct code and passes broken code, so the coverage table below has a column for it.
- **Prohibitions** ("MUST NOT log tokens"): ask whether the forbidden thing happens, `'Is a token written to a log?'` (correct code answers "no"), and assert `maxProbability`. This form is very sharp for some requirements and blind for others; step 6 shows which. Choose the form without stacked negations. Avoid questions that require counting.
- **`choice` and `score` only when something depends on them.** A generic "security posture" or "completeness" rubric is a vague, target-wide judgment. Add one when the user names a decision it drives.
- **Tables are not sent to the model.** jev-spec 0.1.x replaces Markdown tables in the specification with `[table omitted]`. If criteria live in a table, write one question per row and restate the row in it. That only helps those questions: the drift question still cannot see the table and may take required behavior for undocumented behavior. Tell the user, and suggest converting the table to a list, which is the real fix. Do not edit the specification yourself.
- **Thresholds**: start with `minProbability: 0.85` and `maxProbability: 0.15`, and say plainly that these are starting points. They get tuned in step 6, with the real model.

Before you write the file, write the **coverage table**: one row per rubric in requirement order, plus one row for every requirement without a rubric. For each rubric, first decide the answer that correct code gives, then derive the assertion from that answer, never the other way round. Keep the table in the final summary.

```
REQ-AUTH-01  'REQ-AUTH-01 signature'   correct code answers yes  minProbability 0.85
REQ-AUTH-01  'REQ-AUTH-01 expiry'      correct code answers yes  minProbability 0.85   (table row, restated in the question)
REQ-AUTH-02  'REQ-AUTH-02'             correct code answers yes  minProbability 0.85
REQ-AUTH-04  'REQ-AUTH-04'             correct code answers no   maxProbability 0.15   (asks whether a password is compared in plain text)
REQ-BILL-01  'REQ-BILL-01'             correct code answers yes  minProbability 0.85   (not implemented yet: expect this to fail)
REQ-OPS-02   (not covered: an on-call rotation cannot be judged from source code)
(drift)      auth.unspecifiedBehavior  correct code answers no   maxProbability 0.15
```

Read every row back as a sentence before going on: "correct code answers **no** to *Is a password compared in plain text?*, so the probability must stay low: `maxProbability`". A question such as *Are passwords never compared in plain text?* is answered **yes** by correct code and would need `minProbability`; prefer the form without "never" or "not".

Then write `jev-spec.config.ts` from the table, with this skeleton. An assertion key that matches no rubric stops the run with exit code 2; in a repo that type-checks the file, `defineConfig` also makes it a compile error.

```ts
import { defineConfig, noul } from 'jev-spec';

export default defineConfig({
  targets: {
    auth: {
      specPath: 'docs/specs/auth.md',
      // Tests are never part of the implementation under verification.
      codePaths: ['src/auth/**/*.ts', '!**/*.test.ts', '!**/*.spec.ts'],
      // Only when the file holds several domains: specFilter: { requirementPrefix: 'REQ-AUTH-' },
      rubrics: {
        // Correct code answers "yes".
        'REQ-AUTH-02': noul(
          'Is a token rejected when its ID is on the revocation list, even when its signature is valid?'
        ),
        // A prohibition asks whether the forbidden thing happens. Correct code answers "no".
        'REQ-AUTH-04': noul('Is a password compared in plain text?'),
        unspecifiedBehavior: noul(
          'Does the code add behavior that the specification does not describe, such as an alternative way to authenticate?'
        ),
      },
      assertions: {
        'REQ-AUTH-02': { minProbability: 0.85 },
        'REQ-AUTH-04': { maxProbability: 0.15 },
        unspecifiedBehavior: { maxProbability: 0.15 },
      },
    },
  },
});
```

Count requirements, not rubrics: "4 of 5 requirements have at least one rubric (6 rubrics)".

**A requirement the code does not implement yet still gets its rubric.** That check failing is the gate doing its job; warn the user that it will fail until the code exists. "Not covered" is reserved for requirements that cannot be judged from source code at all (operational, organisational or legal ones). Every such row must be visible: a requirement without a rubric is not verified by jev-spec, and that is stated, never implied.

### 5. Validate the wiring offline

No API key is needed for this step. Check `npx jev-spec --help` and take the first branch that applies.

**`--help` lists `--dry-run`:**

```sh
npx jev-spec check --dry-run
```

A dry run evaluates nothing. It prints, per target, the specification sections and requirement IDs it found, the code files it matched and the rubrics it would ask. Exit code `0` means the setup is valid and `2` means it is broken (invalid config, missing spec file, `specFilter` that matches nothing); fix it. Read the report: every target must list the spec file and the code files you expect. Treat each warning as a finding. In particular `no rubric names REQ-…` must agree with the "not covered" rows of your coverage table; if it does not, one of the two is wrong.

**`--help` does not list `--dry-run` (jev-spec 0.1.x):**

```sh
npx jev-spec check --mock
```

Mock mode returns **placeholder verdicts** produced by keyword rules (for example, a `TODO` in the code fails every "satisfy" question, and a `choice` always selects its first option). Only the exit code matters: `0` or `1` means the wiring works, and `1` does **not** mean anything is wrong; `2` means the setup is broken. Read the report for the spec file and code files of every target, then stop.

In both branches: **do not change a rubric, a threshold, the number of score levels or the order of choice options to make an offline run look better.** Offline runs know nothing about the code. If mock verdicts are in the way, the mistake is using mock mode as a gate (see step 7).

### 6. Go live and tune

1. The user creates a key at <https://console.typesafe.ai/keys> and exports `TYPESAFE_AI_API_KEY` (`TYPESAFE_API_KEY` works too). Never write the key into the config or commit it.
2. Run `npx jev-spec check`. A check costs a fraction of a cent.
3. Tune the thresholds: compare the probabilities for code known to be right with a deliberately broken copy (remove a required check, then restore it). Set each threshold between the two with margin. A `noul` that stays near `0.5` means the model cannot tell: improve the question or shrink the target instead of lowering the threshold. A rubric that scores the broken copy like the intact one checks nothing: make the question more literal, name the part of the code, split it into one behaviour, shrink the target or try asking for the violation, and run both copies again. When no wording separates them, the requirement needs reasoning the model does not do (following a value through the code, working out what a regular expression accepts): cover it with a test and list it as not covered in the coverage table. Run the intact code a few times as well: an answer near its threshold moves between runs.
4. Pin the model: copy the versioned ID from the `Model:` line of the report into `client: { model: '…' }` in the config. Without it jev-spec asks the alias `jev-latest`, which moves to a newer model with every release, and the thresholds you just set stop being comparable. (`npx jev-spec --help` on versions before 0.3.0 has no such option; skip this item there.)

If the user has no key yet, finish steps 1–5, say clearly that **nothing has been verified yet**, and leave step 6 as their next action.

### 7. Optional add-ons (ask for each, do not add them silently)

**Pre-commit hook.** Reuse husky, lefthook or pre-commit if the repo has one. Otherwise add `.githooks/pre-commit` (executable) and `"prepare": "git config core.hooksPath .githooks || true"` in `package.json`:

```sh
#!/bin/sh
if [ -z "${TYPESAFE_AI_API_KEY:-}${TYPESAFE_API_KEY:-}" ]; then
  echo "jev-spec: no API key in this shell, skipping spec verification (CI still runs it)." >&2
  exit 0
fi
exec npx --no-install jev-spec check --staged
```

Without a key the hook **skips**. It must not fall back to `--mock`: that would block commits on placeholder verdicts. Do not write the hook into `.git/hooks/`: that directory is not versioned, so no other clone would get it.

Then **run the hook** instead of assuming it works. Activate it first (`npm run prepare`, or `git config core.hooksPath .githooks`), stage a harmless change inside a target, and run `git hook run pre-commit` (or execute the hook file) once without a key and, if a key is available, once with it. Without a key only the skip branch runs, so also run `npx jev-spec check --staged --dry-run` by hand once (`--staged --mock` on 0.1.x): the target of the staged file must be listed with its files and the others `SKIPPED`. Unstage the change afterwards. Report what each run printed and its exit code. A hook that was only written, never executed, is not done.

**GitHub Actions.** Create `.github/workflows/spec-check.yml`. Secrets are only available to pushes and same-repository pull requests; pull requests from forks get a wiring check only.

```yaml
name: spec-check
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
permissions:
  contents: read
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
      - name: Verify code against specs
        if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository
        env:
          TYPESAFE_AI_API_KEY: ${{ secrets.TYPESAFE_AI_API_KEY }}
        run: npx jev-spec check --format markdown >> "$GITHUB_STEP_SUMMARY"
      - name: Validate wiring only (fork pull request, no secrets)
        if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository
        run: npx jev-spec check --dry-run
```

- CI runs the **full** check on purpose. `--diff origin/main...HEAD` sends only diff hunks, which is too little context for "is this requirement satisfied?", and it skips a pull request that changes only the specification. A full check costs cents. Use `--diff` (it needs `fetch-depth: 0`) only when the repo is too large for that.
- The fork step is a dry run: it fails only when the setup is broken. On jev-spec 0.1.x, which has no `--dry-run`, use `npx jev-spec check --mock || [ "$?" -eq 1 ]` instead: it accepts exit codes 0 and 1 and still fails on 2, which is the mock-mode contract from step 5.
- `--output` only accepts paths inside the repository. For the step summary, redirect stdout as shown.
- Until the `TYPESAFE_AI_API_KEY` secret exists, the verify step fails with "API key is required". Tell the user to add the secret first, or to merge the workflow once they have the key. Do not paper over it with `--mock`.

**README section.** Offer a short "Spec checks" block with the two commands (`npx jev-spec check`, `npx jev-spec check --target <name>`).

### 8. Summary

End with a summary in the user's language, in this shape:

```
Done:
  ✓ Installed jev-spec 0.1.x (npm)
  ✓ jev-spec.config.ts: 2 targets, 6 rubrics
  ✓ Wiring validated offline (dry run: exit code 0, no warnings)

Coverage: 5 of 6 requirements have at least one rubric (7 rubrics)
  REQ-OPS-02  not covered: <reason>

Not verified yet: no live run (no API key). Thresholds are untuned starting points.
Next: create a key at https://console.typesafe.ai/keys, export TYPESAFE_AI_API_KEY, run `npx jev-spec check`.
```

Report what you observed, not what you expect: if no live run happened, no requirement has been verified, whatever mock mode printed.

## Edge cases

- **No requirement IDs in the spec**: use `specFilter.headings` to select sections, and suggest adding IDs. Questions then quote the heading instead of an ID.
- **Several spec files for one feature** (Kiro's `requirements.md` + `design.md`): `specPath` takes one file. Point it at the requirements file; design documents are not requirements.
- **Monorepo**: run jev-spec from the package directory that owns the config. In `--staged` / `--diff` mode, changed paths are relative to the repository root, so `codePaths` must be written that way too.
- **A `specFilter` that matches nothing** is an error (exit code 2) since 0.1.1. Check the prefix for typos.
- **Non-English specifications**: write the questions in the same language as the spec, and tune the thresholds (step 6) before trusting them.

## See also

- Documentation: <https://github.com/nozomi-koborinai/jev-spec#readme>
- How Jev answers questions, and what it is bad at: <https://docs.typesafe.ai>
- Sister skill: `jev-spec-fix`, for working through a failing check
