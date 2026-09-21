# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- New tagline, "Catch spec drift on every commit.", in the four READMEs, in the package description and in the hero image. The previous one, "Unit tests for your specs.", read as if the spec were the thing under test, and a unit test is deterministic while a check is a probability compared with a threshold. The hero image is now a real PNG (the old file was a JPEG with a `.png` name) and can be rendered again from `assets/hero.html`.
- The README introduction was rewritten in all four languages. It now opens with what the tool does and an example report, explains the approach in four steps, and adds a "Know the limits" section. Figures that had no source (latency ranges, per-file LLM costs, "100x cheaper") were removed; the price, the model's properties and its limitations link to the TypeSafe documentation instead. The Quickstart links to the page where an API key is created.
- The README states that jev-spec is an independent open-source project, not affiliated with or endorsed by TypeSafe AI, and asks for problems to be reported in this repository.

### Internal

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
