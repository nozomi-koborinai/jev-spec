import { defineConfig, noul } from 'jev-spec';

// jev-spec checks itself. The specs under docs/specs/ are normative (see AGENTS.md), and each
// target pairs one group of requirements with the one to three files that implement it.
//
// Every rubric is named after the requirement it checks. How the questions are written comes from
// the live runs recorded in docs/probe-results.md, where each wording was tried on the intact code
// and on a copy that test/probes/ had broken:
// - Ask directly and literally about the mechanism ("does the validation add an issue when ...").
//   "Does the code satisfy REQ-X: <requirement>?" was answered "yes" for broken code too: the
//   restated requirement reads like a claim, and the model is sensitive to claims.
// - Keep the requirement ID out of the question. The name of a rubric is not sent to the model.
// - One behaviour per question, and say which part of the code is meant when there are two
//   similar ones.
// - Keep the code of a target small. The same question separated intact from broken code less
//   well when an unrelated file was sent along.
// - Asking whether something forbidden happens works well for some requirements and not at all
//   for others, so try it on a probe instead of assuming it.
//
// Thresholds: to the questions that should be answered "yes", intact code scored 0.90 or more and
// broken code 0.73 or less; to those that should be answered "no", 0.06 or less and 0.94 or more.
// An answer about intact code moved by at most 0.03 between identical runs. An uncertain answer
// about broken code moved by as much as 0.4, which is why the threshold sits nearer to the intact
// scores.
const MET = { minProbability: 0.85 } as const;
const NOT_VIOLATED = { maxProbability: 0.3 } as const;

export default defineConfig({
  client: { model: 'jev-1.13.0' },
  targets: {
    exitCodes: {
      description: 'Exit codes of the check command',
      specPath: 'docs/specs/exit-codes.md',
      codePaths: ['bin/jev-spec.js', 'src/cli/main.ts', 'src/cli/commands/check.ts'],
      rubrics: {
        'REQ-EXIT-01': noul(
          'When every target that was checked passes, does the check command return exit code 0?'
        ),
        'REQ-EXIT-02': noul(
          'When at least one assertion of a checked target is violated, does the check command return exit code 1?'
        ),
        'REQ-EXIT-03': noul(
          'When the check command catches an error, does it print the error and return exit code 2?'
        ),
        'REQ-EXIT-04': noul(
          'Do --help and --version print their output and return exit code 0 before any configuration file is loaded?'
        ),
      },
      assertions: {
        'REQ-EXIT-01': MET,
        'REQ-EXIT-02': MET,
        'REQ-EXIT-03': MET,
        'REQ-EXIT-04': MET,
      },
    },

    configuration: {
      description: 'A mistake in the configuration is rejected',
      specPath: 'docs/specs/fail-closed.md',
      specFilter: { requirementPrefix: 'REQ-CONFIG-' },
      codePaths: ['src/config-validation.ts'],
      rubrics: {
        'REQ-CONFIG-01': noul(
          'Does the validation add an issue when the targets object of a configuration has no keys?'
        ),
        'REQ-CONFIG-02': noul(
          'Does the validation add an issue for an assertion whose key is not the name of a rubric of the same target?'
        ),
        'REQ-CONFIG-03': noul(
          'Does the validation add an issue for every assertion key that is not in the list of options allowed for the type of its rubric?'
        ),
        'REQ-CONFIG-04': noul(
          'Does the condition that rejects a threshold test whether the value is below the minimum or above the maximum?'
        ),
        'REQ-CONFIG-05': noul(
          'Does the validation collect every issue it finds and throw one error that lists all of them?'
        ),
      },
      assertions: {
        'REQ-CONFIG-01': MET,
        'REQ-CONFIG-02': MET,
        'REQ-CONFIG-03': MET,
        'REQ-CONFIG-04': MET,
        'REQ-CONFIG-05': MET,
      },
    },

    run: {
      description: 'A run validates before it does anything else',
      specPath: 'docs/specs/fail-closed.md',
      specFilter: { requirementPrefix: 'REQ-RUN-' },
      codePaths: ['src/runner/engine.ts'],
      rubrics: {
        'REQ-RUN-01': noul(
          'Does a run validate the configuration before it reads a spec, reads code or creates the client of the API?'
        ),
      },
      assertions: {
        'REQ-RUN-01': MET,
      },
    },

    answers: {
      description: 'An answer that cannot be read fails its assertion',
      specPath: 'docs/specs/fail-closed.md',
      specFilter: { requirementPrefix: 'REQ-ANSWER-' },
      codePaths: ['src/runner/assertion-runner.ts'],
      rubrics: {
        'REQ-ANSWER-01': noul(
          'When the probability, the confidence or the score of an answer is not a finite number, does the assertion on that answer fail?'
        ),
        'REQ-ANSWER-03': noul(
          'When a rubric has no assertion, is its evaluation recorded as passed?'
        ),
      },
      assertions: {
        'REQ-ANSWER-01': MET,
        'REQ-ANSWER-03': MET,
      },
    },

    paths: {
      description: 'Files are read only from inside the project root',
      specPath: 'docs/specs/security.md',
      specFilter: { requirementPrefix: 'REQ-PATH-' },
      codePaths: ['src/context/path-security.ts', 'src/context/glob-matcher.ts'],
      rubrics: {
        'REQ-PATH-01': noul(
          'Does the asynchronous function that resolves a path with realpath throw an error when the resolved path lies outside the project root?'
        ),
        'REQ-PATH-02': noul(
          'Is a glob pattern that is absolute, or that contains a ".." segment, rejected with an error before any file is matched?'
        ),
        'REQ-PATH-03': noul(
          'Are symbolic links followed while files are matched against glob patterns?'
        ),
        'REQ-PATH-04': noul(
          'In the function that resolves glob patterns against the file system, does the ignore list start with the default patterns for environment files, the .git directory and private key files?'
        ),
      },
      assertions: {
        'REQ-PATH-01': MET,
        'REQ-PATH-02': MET,
        'REQ-PATH-03': NOT_VIOLATED,
        'REQ-PATH-04': MET,
      },
    },

    git: {
      description: 'git is started safely with an untrusted revision range',
      specPath: 'docs/specs/security.md',
      specFilter: { requirementPrefix: 'REQ-GIT-' },
      codePaths: ['src/context/git-revision.ts', 'src/context/git-diff.ts'],
      rubrics: {
        'REQ-GIT-01': noul(
          'Is git started through a shell, or is a shell command line built from its arguments?'
        ),
        'REQ-GIT-03': noul(
          'Is the revision range passed to git after "--end-of-options" and followed by "--"?'
        ),
      },
      assertions: {
        'REQ-GIT-01': NOT_VIOLATED,
        'REQ-GIT-03': MET,
      },
    },
  },
});
