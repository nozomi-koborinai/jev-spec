# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-09-21

A bug-fix release. Several of these bugs made a check pass, fail or get skipped for the wrong reason, so upgrading is recommended for everyone on 0.1.0.

### Fixed

- **`--diff <range>` never saw the diff.** The revision range was passed to git after `--`, so git read `origin/main...HEAD` as a pathspec and returned an empty diff. The range is now passed as a revision, guarded by `--end-of-options`.
- **Zones without matching changes were still evaluated in `--staged` / `--diff` mode.** They were sent to Jev with an empty implementation and usually failed, which made a pre-commit hook block unrelated commits. Such zones are now reported as `SKIPPED`, are not sent to Jev, and do not affect the exit code.
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

### Upgrade notes

- A configuration that contained one of the mistakes listed above used to run (and pass); it now stops with exit code `2` and a message that points at the offending config path. Fix the configuration rather than pinning 0.1.0.
- With `specFilter.requirementPrefix` now effective, a zone receives only the matching requirement sections (and their subsections). Sections that merely sit next to them, such as a general overview, are no longer part of the context. If a rubric depends on such a section, select sections with `specFilter.headings` instead, or drop the filter.

## [0.1.0] - 2026-09-20

- Initial release.

[0.1.1]: https://github.com/nozomi-koborinai/jev-spec/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/nozomi-koborinai/jev-spec/releases/tag/v0.1.0
