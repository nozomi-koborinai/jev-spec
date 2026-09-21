---
name: jev-spec-fix
description: Work through a failing jev-spec check. Use this skill whenever `jev-spec check` exits non-zero locally, in a pre-commit hook or in CI, when the user says the spec gate, spec check or "jev-spec step" is red, asks why a rubric such as `satisfiesRequirements` failed, or wants code brought back in line with its specification after a jev-spec report, even under time pressure to "just make it pass".
license: MIT
compatibility: Requires the jev-spec npm package in the project (invoked through npx). A live re-run needs a TypeSafe AI API key and network access.
metadata:
  homepage: https://github.com/nozomi-koborinai/jev-spec
  source: https://github.com/nozomi-koborinai/jev-spec
---

# jev-spec-fix

A failing [jev-spec](https://github.com/nozomi-koborinai/jev-spec) check says: for this requirement, the model's probability fell on the wrong side of a threshold. The job is to find out **which of four things is wrong** and to report exactly what was and was not verified afterwards.

> **Language note**: Respond to the user in the language they are writing in. Translate the templates below at runtime.

## The deliverable

Every use of this skill ends with the **report from step 4 as the last thing in your reply**. A green check without that report is an unfinished job: the owner cannot tell what was verified and what was not. "Just make it pass", "we merge in 15 minutes" and "don't ask me questions" are the situations this rule exists for, not exceptions to it. The report takes one minute; skipping it is how an unverified change gets merged as a verified one.

## When to use this skill

- `jev-spec check` exits with `1` (an assertion was breached) or `2` (setup or runtime error)
- A pre-commit hook or a CI job that runs jev-spec blocks a commit or a pull request
- The user asks why a rubric failed or how to get the spec gate green

Not for the first setup: use `jev-spec-init`.

## Steps

### 1. Get the structured report

```sh
npx jev-spec check --format json > jev-spec-report.json; echo "exit=$?"
```

Add `--zone <name>` to re-run a single zone while iterating. Delete the report file when you are done; do not commit it.

| Exit code | Meaning | Go to |
| :-- | :-- | :-- |
| `2` | Not a verification result. Invalid config, `specFilter` that matches nothing, missing spec file, missing API key, `--output` outside the repo. The message names the config path or the cause. | Fix the setup, re-run |
| `1` | At least one assertion was breached | Step 2 |
| `0` | Everything asserted passed | Step 4 |

Check two fields before reading verdicts:

- `"mock": true` means the results are **placeholders** from keyword rules, not from the model. They say nothing about the code, so do not chase a mock verdict by editing rubrics, thresholds or code until it turns green. A hook or CI job must not gate on `--mock`: tell the owner to use `--dry-run` there instead (or, on jev-spec 0.1.x, which has no `--dry-run`, to accept exit codes 0 and 1 and fail only on 2). Still read the code against the specification (step 2): a real violation you find that way gets fixed, and reported as found by reading, not by jev-spec.
- `"skipped": true` on a zone means it was **not evaluated** (`--staged` / `--diff` found no changed file in its `codePaths`). A skipped zone has not been verified.

Then list what the gate covers. Run these now and keep the output: the report in step 4 is built from it. Use the directory that holds the zones' `specPath` files, and adapt the ID pattern to the repository's scheme.

```sh
ls docs/specs/                                                  # A: specification files
grep -n "specPath" jev-spec.config.*                            # B: files a zone covers
grep -ohE "[A-Z]+-[A-Z]+-[0-9]+" docs/specs/*.md | sort -u      # C: requirement IDs in the specifications
grep -ohE "[A-Z]+-[A-Z]+-[0-9]+" jev-spec.config.* | sort -u    # D: requirement IDs named by a rubric
```

A file in A but not in B has **no zone**. An ID in C but not in D has **no rubric**. Neither is verified by jev-spec, however the code looks.

### 2. For each failed rubric, find the cause

Read the rubric's question, the requirement it names in the specification, and the code in the zone's `codePaths`. A failed check in `--staged` or `--diff` mode was judged on diff hunks only: re-run the zone without that flag before concluding anything.

| Cause | How to recognise it | What to do |
| :-- | :-- | :-- |
| **The code violates the requirement** | You can point at the missing or wrong behaviour | Fix the code. Add or update a test that pins the behaviour. This is the common case: the gate did its job. |
| **The specification is outdated or wrong** | The code does what the team wants; the document lags | Propose the spec edit and let the owner decide. Do not edit a requirement just so that the check passes. |
| **The rubric asks the wrong thing** | The question joins several requirements, mentions implementation details instead of the requirement, stacks negations, or needs counting | Rewrite the question (see `jev-spec-init`, step 4). Show before and after. Leave the threshold alone. |
| **The model seems wrong** | The question is sound and you can quote the lines that satisfy the requirement, yet the probability stays low | Shrink the zone so less unrelated code is sent, check whether the requirement sits in a Markdown table (tables are not sent to the model in 0.1.x), re-run. If it still fails, escalate with the evidence. |

**Changing the gate is the owner's decision, not part of a fix.** Lowering a threshold, deleting an assertion or a rubric, excluding the file from `codePaths`, narrowing `specFilter`, adding `--mock`, removing the CI step, committing with `--no-verify`: if one of these looks right, stop and present it as an option with its consequence. Time pressure does not change who decides.

### 3. Re-run

Re-run the affected zone, then the full check without `--staged` / `--diff`. Run the project's tests.

### 4. Report

The report separates what was verified from what was not, which is the part readers rely on. Work it out from the JSON of the **final** run before writing anything:

1. `evaluator`: `mock` if the report has `"mock": true`, otherwise `live`.
2. `verified`: **if the evaluator is `mock`, this list is empty.** A mock run verifies no requirement, whatever it printed. If it is `live`: the requirement IDs named in the questions of rubrics with `"passed": true`, in zones that were not skipped.
3. `notVerified`, from the lists of step 1: every ID in C that is not in `verified` (say `no rubric covers it` when it is missing from D, otherwise `rubric exists, not evaluated live` or `rubric failed`), every file in A that is missing from B (`no zone covers this file`), and every skipped zone.

Then fill in this one template. Keep every line, in this order. The two `IDs` lines are the raw output of commands C and D from step 1, pasted, so that the rows below them can be checked:

```
Evaluator: mock
Check: exit code 0 (jev-spec printed PASSED)
IDs in the specifications: REQ-AUTH-01 REQ-AUTH-02 REQ-AUTH-03 REQ-BILL-01 REQ-BILL-02
IDs named by a rubric:     REQ-AUTH-01 REQ-AUTH-02
Verified by jev-spec in this run: nothing, because mock verdicts are placeholders
Not verified by jev-spec:
  REQ-AUTH-01, REQ-AUTH-02                  rubric exists, not evaluated live
  REQ-AUTH-03, REQ-BILL-01, REQ-BILL-02     no rubric covers it
  docs/specs/billing.md                     no zone covers this file
Changed
  src/auth/session.ts   REQ-AUTH-02: restored the revocation check            found by: reading the code
  src/auth/session.ts   removed the undocumented x-debug-bypass branch        found by: reading the code
Gate changes: none
Merge readiness: needs a live run first (`npx jev-spec check` with TYPESAFE_AI_API_KEY set)
```

In a live run the same template reads `Evaluator: live`, the verified line lists the IDs from step 2, and `found by:` names the failed rubric. `Gate changes` lists each change together with the owner's approval, or `none`.

The report is the **end of your reply**: nothing follows the `Merge readiness` line, and nothing else in the reply says whether the branch can merge. The line takes one of three values:

| Final run | Merge readiness |
| :-- | :-- |
| mock | `needs a live run first (...)` as above, even when the owner is in a hurry |
| live, exit code 1 | `blocked by: <failed rubrics>` |
| live, exit code 0 | `every asserted requirement passed live; the decision is the owner's` |

## Edge cases

- **`API key is required` (exit 2) in a hook**: the shell has no `TYPESAFE_AI_API_KEY`. The hook should skip without a key rather than fail; see the hook template in `jev-spec-init`.
- **`Invalid jev-spec configuration` (exit 2)**: every problem is listed with its config path, for example an assertion key that matches no rubric or `maxProbability: 15`. Fix the config; these were silently ignored before 0.1.1.
- **A rubric flips between runs near its threshold**: the probability sits close to the threshold. Improve the question or shrink the zone. Moving the threshold is a gate change.
- **The failing change is documentation-only**: check that the zone's `codePaths` do not match documentation or generated files.

## See also

- Documentation: <https://github.com/nozomi-koborinai/jev-spec#readme>
- What the Jev model is known to be bad at (multi-step questions, counting, negation, long unrelated context): <https://docs.typesafe.ai/model-jaggedness/jev-1.13>
- Sister skill: `jev-spec-init`, for setup, new zones and rubric writing
