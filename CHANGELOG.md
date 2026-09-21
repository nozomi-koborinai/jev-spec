# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `client.model` pins the model that answers, for example `model: 'jev-1.13.0'`. Without it jev-spec asks the alias `jev-latest`, which TypeSafe moves to a newer model with every release, so a result could change without any change in the repository. `TYPESAFE_DEFAULT_MODEL` is honoured as well. Every report now prints the versioned model that answered (`Model: jev-1.13.0`; `targets[].model` in JSON), and `--dry-run` warns while the model is an alias (`warnings` at the top level of the JSON report). A `client.model` that is not a non-empty string is a configuration error (exit code `2`).

### Changed

- The README and the `jev-spec-init` skill teach a different way to write a rubric, because the one they taught did worst in the first live measurements. Name the rubric after its requirement (`'REQ-AUTH-02': noul('…')`) and ask one direct, literal question about what the code must do, without the requirement ID in it. "Does the code satisfy REQ-AUTH-01: …?" was answered "yes" for code that had been broken on purpose. The skill also makes the agent state, for every rubric, whether correct code answers yes or no, after a test run paired a "yes means good" question with `maxProbability`. The example report now shows rubrics named after requirements, so a failure names the requirement that drifted.
- New README section, "jev-spec checks itself": the project's own specs, probes and the recorded result (18 of 18 probes caught with `jev-1.13.0`; a full check of 6 targets and 18 rubrics takes under three seconds and an estimated $0.0004).
- `--dry-run` counts a requirement as covered when a rubric is **named** after it (`'REQ-AUTH-02': noul('…')`), not only when its ID appears in the question. The name of a rubric is never sent to the model, and in our measurements an ID inside the question made the model less able to tell intact code from broken code.
- New tagline, "Catch spec drift on every commit.", in the four READMEs, in the package description and in the hero image. The previous one, "Unit tests for your specs.", read as if the spec were the thing under test, and a unit test is deterministic while a check is a probability compared with a threshold. The hero image is now a real PNG (the old file was a JPEG with a `.png` name) and can be rendered again from `assets/hero.html`.
- The README introduction was rewritten in all four languages. It now opens with what the tool does and an example report, explains the approach in four steps, and adds a "Know the limits" section. Figures that had no source (latency ranges, per-file LLM costs, "100x cheaper") were removed; the price, the model's properties and its limitations link to the TypeSafe documentation instead. The Quickstart links to the page where an API key is created.
- The README states that jev-spec is an independent open-source project, not affiliated with or endorsed by TypeSafe AI, and asks for problems to be reported in this repository.
- **Breaking: zones are now called targets.** A target is one part of a spec paired with the code that implements it, checked as a unit; "zone" suggested a region of the code base and never said so. The configuration key `zones` is `targets`, the CLI option `--zone` / `-z` is `--target` / `-t`, and the JSON report has `targets[].targetName` instead of `zones[].zoneName`. The exported names follow: `ZoneConfig` is `TargetConfig`, `AnyZoneConfig` is `AnyTargetConfig`, `ZoneCheckResult` is `TargetCheckResult`, `ZonePlan` is `TargetPlan`. There is no alias: a configuration that still has `zones` stops with exit code `2` (`"targets" object is required`).
- **Breaking: the act is called a check everywhere, no longer a verification.** The exported `runVerification` is `runChecks`. The terminal report is headed "jev-spec Check Report" and ends with "CHECKS FAILED" when an assertion is violated (it said "VERIFICATION FAILED"; the passing line already said "ALL CHECKS PASSED"). The markdown report is headed "Check Summary", the help text says "Check a single target", and the dry-run warning reads "jev-spec does not check these requirements". "Verify" suggested proof, and a check compares a probability with a threshold.
- The READMEs define a target where it is configured, and the Chinese and Korean READMEs use one word for it throughout (they mixed "Zone" with a translation).
- The documentation no longer promises what it cannot show. The security table is headed "What It Does" instead of "Implementation Guarantee", and the row about prompt boundaries says that the tags and the framing note are a mitigation: TypeSafe documents that content which argues for its own classification, such as a comment that claims compliance, can move the answer. `SECURITY.md` says the same, and no longer claims that the note is prepended to the questions (it is part of the state). "Know the limits" now says that Jev is most accurate in English and less accurate in other languages, CJK included. Thresholds are *tuned*, not *calibrated*: calibration is a property of the model's probabilities, in the READMEs and in `jev-spec-init`.
- **Breaking for custom evaluators:** `JevEvaluator.evaluate()` resolves to `{ answers, model? }` instead of the bare record of answers, so that an evaluator can report which model answered. `LiveJevEvaluator` accepts a client as a second constructor argument, which makes it testable without the network.

### Fixed

- An unexpected internal error made the process exit with Node's default code `1`, which jev-spec reserves for a violated assertion. Every error now exits with `2`.

### Upgrade notes

- Rename `zones` to `targets` in `jev-spec.config.*`, and `--zone` to `--target` in scripts, hooks and workflows.
- If something parses the JSON report, read `targets` and `targetName`. If something searches the terminal report for `VERIFICATION FAILED`, it is `CHECKS FAILED` now; the exit code is the better signal.
- If you call the library, `runVerification` is `runChecks` and the `Zone*` types are `Target*`.
- After tuning thresholds, set `client.model` to the versioned ID that the report prints.
- A custom `JevEvaluator` returns `{ answers }` now.

### Internal

- jev-spec checks itself. `docs/specs/` holds its first twenty requirements (exit codes, failing closed, path and git safety), and `jev-spec.config.ts` pairs each group with the one to three files that implement it; two of the three spec files serve two targets each through `specFilter.requirementPrefix`. The test suite runs a dry run of that configuration and fails on any warning, on a requirement ID that is declared twice, and on a requirement that neither a rubric nor a test title names. No live run has happened yet, so the thresholds are untuned.
- First live run of jev-spec on itself, recorded in `docs/probe-results.md`: all 18 rubrics pass on the intact code and fail on the copy that their probe breaks (`jev-1.13.0`). Getting there changed the rubrics, not the thresholds: direct, literal questions about the mechanism, without the requirement ID, separate intact from broken code far better than "Does the code satisfy REQ-X: …?", which was answered "yes" for broken code in 4 of 20 cases; smaller targets help as well. Two requirements that no wording could check (one follows a value through a function, one depends on what a regular expression accepts) moved to `docs/specs/checked-by-tests.md`. The run also found dead code: an unused error class in the check command could have exited with `1`; it is gone.
- Probes: `test/probes/<ID>.patch` breaks one requirement each, in a file that the target of that requirement sends to the model. `npm run probes` checks the intact sources and a patched copy and reports, per requirement, whether the rubric passed the first and failed the second, which is what earns a rubric its place in the gate. It needs an API key; the test suite keeps the probes from rotting without one (one probe per requirement, every patch still applies, no patch touches a file the model does not see).
- The toy authentication fixture is gone. Tests read the real specs and sources of this repository and assert structure only; tests that need broken input still build it in a temporary directory. Four behaviours that the new requirements describe had no test (exit code `0`, exit code `1`, a missing answer, the default exclusion of secrets) and have one now.
- `CONTEXT.md` defines the project's vocabulary (check, target, drift, rubric, assertion, run and the words each of them replaces), and `AGENTS.md` points to it. The code and the documentation are aligned with it in the following changes.
- The release workflow builds the GitHub Release body from the version's section of `CHANGELOG.md` (`scripts/release-notes.mjs`). It runs before `npm publish` and stops the release when the tag does not match `package.json`, when the changelog has no section for the version, or when that section is empty. `softprops/action-gh-release` moves from `v2`, which is no longer maintained, to `v3` (Node 24 runtime, same inputs).

## [0.2.0] - 2026-09-21

Adds a way to validate a setup without an API key, and two Agent Skills that set jev-spec up and work through failing checks. No change to how checks are evaluated.

### Added

- `jev-spec check --dry-run` validates a setup without evaluating anything: configuration, spec parsing and file matching. It needs no API key, prints per zone what would be sent (spec sections, requirement IDs, code files, context sizes, rubrics, estimated cost), and exits with `0` when the setup is valid or `2` when it is not. It warns about requirement IDs that no rubric mentions, `codePaths` that match no file, and a code context that would be cut at the size budget. JSON output gains `dryRun` and a per-zone `plan`. It cannot be combined with `--mock`.
- `ExtractedCodeContext.truncated` tells whether the code context was cut at the character budget.
- Two [Agent Skills](https://agentskills.io) for coding agents, installable with `gh skill install nozomi-koborinai/jev-spec <name>`:
  - `jev-spec-init` sets jev-spec up in a repository: it maps specifications to code, writes one focused question per requirement, validates the wiring offline, and reports which requirements are not covered.
  - `jev-spec-fix` works through a failing check: it separates the four possible causes (code, specification, rubric, model) and ends with a report of what was and was not verified.
- `AGENTS.md` with the conventions for coding agents that work on this repository.

### Changed

- The recommended GitHub Actions workflow validates pull requests from forks with `--dry-run` instead of `--mock`. A mock run exits with `1` on placeholder verdicts, which made fork pull requests fail for reasons unrelated to their content.
- The Quickstart in the README asks one question per requirement instead of joining `REQ-AUTH-01` and `REQ-AUTH-02` in a single question, in line with the guidance in the new skills.
- The exported union types no longer contain `any`: `AnyRubric`, `AnyAssertion` and `AnyRubricResult` use `string` for choice keys, and `JevSpecConfig.zones` is typed as the new exported `AnyZoneConfig` instead of `ZoneConfig<any>`. Runtime behaviour is unchanged. Hand-written `JevSpecConfig` objects are now type-checked more strictly (for example, a misspelled assertion option is a compile error).

### Internal

- Biome now lints and formats the code base. `npm run lint` runs `biome check --error-on-warnings .`, `npm run lint:fix` applies formatting and safe fixes, and CI runs the lint step.

### Upgrade notes

- If a workflow or hook runs `jev-spec check --mock` only to confirm that the setup works, switch it to `--dry-run`. Mock mode still exists, but its exit code `1` reflects placeholder verdicts, not a problem with the setup.
- TypeScript users who build a `JevSpecConfig` object by hand, without `defineConfig`, may see new compile errors where `any` used to hide a mistake. Configurations written with `defineConfig` are unaffected.

## [0.1.1] - 2026-09-21

A bug-fix release. Several of these bugs made a check pass, fail or get skipped for the wrong reason, so upgrading is recommended for everyone on 0.1.0.

### Fixed

- **`--diff <range>` never saw the diff.** The revision range was passed to git after `--`, so git read `origin/main...HEAD` as a pathspec and returned an empty diff. The range is now passed as a revision, guarded by `--end-of-options`.
- **Zones without matching changes were still evaluated in `--staged` / `--diff` mode.** They were sent to Jev with an empty implementation and usually failed, which made a pre-commit hook block unrelated commits. Such zones are now reported as `SKIPPED`, are not sent to Jev, and do not affect the exit code. Their specification is not even loaded, and a run in which every zone is skipped does not need an API key, so a commit that touches no zone cannot be blocked by a problem in one.
- **`specFilter.requirementPrefix` did not filter anything**, so the whole specification was sent for every zone. It now keeps the sections that contain a matching requirement ID together with their nested subsections.
- **A `specFilter` that matches no section is now an error** (`SpecFilterError`, exit code `2`) instead of silently falling back to the entire document.
- **The GitHub Actions workflow in the README did not work.** `--output $GITHUB_STEP_SUMMARY` is outside the workspace and was rejected, and only after the evaluation had run. The output path is now validated up front, and the documented workflow redirects stdout (`>> "$GITHUB_STEP_SUMMARY"`). The example also runs a full verification on `push`, where `origin/main...HEAD` is an empty range.
- **Invalid configurations could silently disable a check.** A mistyped assertion key, an option that does not fit the rubric type, an unknown choice key, an out-of-range threshold (for example `maxProbability: 15`) or an assertion without any threshold now abort the run with exit code `2`, listing every problem with its config path.
- **`minConfidence` on `score` assertions was documented but never enforced.** It is now checked.
- **Non-finite evaluator values (`NaN`) passed every threshold.** They now fail the assertion.
- **`defineConfig` did not type-check assertions.** It is now generic per zone: assertion keys, assertion options and `allowedChoices` / `blockedChoices` are checked by TypeScript against the rubrics of the same zone.
- **`npx jev-spec` / `bunx jev-spec` without a local installation could not load the documented config** (`Cannot find module 'jev-spec'`). The `jev-spec` import inside a config now resolves to the running package.
- **`jev-spec --help` and `--version` printed a "configuration file not found" error**, and unknown commands, mistyped options (`--stagd`), unsupported `--format` values and missing option values were silently ignored. Arguments are now parsed strictly and rejected with exit code `2` and a usage message.

### Added

- `--mock` flag to run with the offline mock evaluator without touching the configuration file (used by the fork pull request step of the recommended workflow).
- `-h, --help` and `-v, --version`.
- `--name=value` syntax for CLI options.
- Mock runs are flagged: `mock: true` in the JSON result and a `MOCK MODE` banner in the terminal and markdown reports.
- Skipped zones are flagged with `skipped` / `skipReason` in the JSON result.
- `validateConfig()`, `ConfigValidationError` and `SpecFilterError` are exported from the package entry point.

### Removed

- Three runtime dependencies that were never imported: `mdast-util-to-markdown`, `micromark` (still installed transitively through `mdast-util-from-markdown`) and `unist-util-visit`.

### Upgrade notes

- A configuration that contained one of the mistakes listed above used to run (and pass); it now stops with exit code `2` and a message that points at the offending config path. Fix the configuration rather than pinning 0.1.0.
- With `specFilter.requirementPrefix` now effective, a zone receives only the matching requirement sections (and their subsections). Sections that merely sit next to them, such as a general overview, are no longer part of the context. If a rubric depends on such a section, select sections with `specFilter.headings` instead, or drop the filter.

## [0.1.0] - 2026-09-20

- Initial release.

[Unreleased]: https://github.com/nozomi-koborinai/jev-spec/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/nozomi-koborinai/jev-spec/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/nozomi-koborinai/jev-spec/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/nozomi-koborinai/jev-spec/releases/tag/v0.1.0
