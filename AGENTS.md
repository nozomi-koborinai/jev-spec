# AGENTS.md

Instructions for coding agents working on this repository. For what the tool does and how it is used, read `README.md`.

## What matters most

jev-spec enforces a **gate**: it checks source code against Markdown specs and fails CI when an assertion is violated. The worst possible bug is a check that passes without having checked anything. When in doubt, fail closed.

## Commands

- `npm run check`: everything CI runs, in order: Biome (lint and format check), type check, tests. Run it before every commit.
- `npm run lint:fix`: applies Biome formatting and safe fixes. Do not format by hand.
- `npm test`: builds first, then runs `node:test` against the **compiled** files in `dist-test/`. If a test seems to ignore your change, the build failed.
- `npx bun test` must pass too. CI runs the suite on Node 22, Node 24 and Bun.

## Rules that are easy to get wrong

1. **Fail closed.** Invalid configuration, malformed evaluator answers and unknown CLI arguments are errors (exit code 2), never a silent pass or a silent default. A new config option needs validation in `src/config-validation.ts`.
2. **Bug fixes are test-first.** Write the failing test, watch it fail for the expected reason, then fix. Code that shells out to git needs a test against a real temporary repository (`test/git-test-utils.ts`), not only a test of the output parser.
3. **Four READMEs.** `README.md`, `README.ja.md`, `README.zh.md` and `README.ko.md` are edited together and stay structurally identical: same headings, same code blocks, same order.
4. **Security invariants.** Every path that comes from the configuration or the CLI goes through `assertInsideRoot`. Git is called with `execFile` (no shell), and revisions go through `assertGitRevision`. If you change one of these, update the security table in the READMEs in the same pull request.
5. **The TypeSafe SDK is 0.x.** Check `node_modules/@typesafe-ai/sdk/dist/index.d.mts` and <https://docs.typesafe.ai> before relying on a response shape, a limit or a price. Do not guess.
6. **Changelog.** User-visible changes go under *Unreleased* in `CHANGELOG.md`.
7. **Skills are product surface.** `skills/` holds the Agent Skills shipped to jev-spec users. When a CLI flag, a config option or the report format changes, update the affected skill in the same pull request.
8. **Vocabulary.** `CONTEXT.md` is the glossary. Read it before you name anything (an identifier, a message, a heading, a commit) and use its terms; each entry lists the words it replaces. A new domain term is added there in the same pull request that introduces it.
9. **Specs.** `docs/specs/` is normative: it states what jev-spec must do, one requirement per `### REQ-<AREA>-<NN>: …` heading, and jev-spec checks itself against it (`jev-spec.config.ts`). A change of behaviour changes the requirement in the same pull request, and the README follows the specs. Write a requirement as present-tense sentences about one behaviour that can be seen in one or two files, readable without any other requirement. Give it a rubric in `jev-spec.config.ts`, named after the requirement (`'REQ-EXIT-02': noul('…')`), or a test whose title starts with its ID: `test/own-specs.test.ts` fails otherwise, and also when `jev-spec check --dry-run` has a warning. A requirement with a rubric also gets a probe, `test/probes/<ID>.patch`, which breaks that one requirement in a file the target sends to the model: `npm run probes` (needs an API key) shows that the rubric passes on the intact code and fails on the broken copy. When a refactoring makes a probe stale, regenerate the patch instead of deleting it. CI runs the live check as a job that reports and does not block (`.github/workflows/jev-spec.yml`); read its summary when it fails, and treat a failure as drift until shown otherwise. Write the question of a rubric as a direct, literal question about the mechanism, without the requirement ID in it, and keep the wording only if the probe shows that it tells intact from broken code (`docs/probe-results.md`). A requirement that no wording can check, because it needs a value to be followed through the code or a regular expression to be understood, moves to `docs/specs/checked-by-tests.md`.
10. **English for the glossary and the specs.** Jev reads English most accurately (<https://docs.typesafe.ai/models#language-support>), and jev-spec checks itself against these documents. The translated READMEs are the only non-English documents.

## Commits, pull requests, releases

- Conventional Commits in English (`fix:`, `feat:`, `docs:`, `chore:`, `refactor:`, `style:`). One logical change per commit; mechanical changes such as formatting get their own commit.
- Releasing: bump `package.json`, move *Unreleased* to the new version in `CHANGELOG.md`, merge, then push an annotated tag `vX.Y.Z`. The release workflow publishes to npm and uses that version's changelog section as the GitHub Release body. Before it publishes, it stops if the tag does not match `package.json` or if `CHANGELOG.md` has no section for the version (`node scripts/release-notes.mjs vX.Y.Z` runs the same check locally).
- Publishing to npm cannot be undone. Never push a version tag without the maintainer's explicit go-ahead.
