import { defineConfig, noul } from 'jev-spec';

// jev-spec checks itself. The specs under docs/specs/ are normative (see AGENTS.md), and each
// target pairs one group of requirements with the one to three files that implement it.
//
// One rubric per requirement, and the question restates the requirement, so the model does not
// have to look the ID up. A requirement that forbids something is asked as a violation.
//
// The thresholds are starting points. No live run has tuned them yet.
const MET = { minProbability: 0.85 } as const;
const NOT_VIOLATED = { maxProbability: 0.15 } as const;

export default defineConfig({
  client: { model: 'jev-1.13.0' },
  targets: {
    exitCodes: {
      description: 'Exit codes of the check command',
      specPath: 'docs/specs/exit-codes.md',
      codePaths: ['bin/jev-spec.js', 'src/cli/main.ts', 'src/cli/commands/check.ts'],
      rubrics: {
        passExitsWithZero: noul(
          'Does the code satisfy REQ-EXIT-01: when every target that was checked passes, the check command exits with code 0?'
        ),
        violationExitsWithOne: noul(
          'Does the code satisfy REQ-EXIT-02: when at least one assertion of a checked target is violated, the check command exits with code 1?'
        ),
        errorExitsWithTwo: noul(
          'Does the code satisfy REQ-EXIT-03: when a run cannot be carried out, including after an unexpected internal error, the command prints the error and exits with code 2?'
        ),
        helpAndVersionNeedNoConfig: noul(
          'Does the code satisfy REQ-EXIT-04: --help and --version print their output and exit with code 0 without loading a configuration file?'
        ),
      },
      assertions: {
        passExitsWithZero: MET,
        violationExitsWithOne: MET,
        errorExitsWithTwo: MET,
        helpAndVersionNeedNoConfig: MET,
      },
    },

    configuration: {
      description: 'A mistake in the configuration stops the run',
      specPath: 'docs/specs/fail-closed.md',
      specFilter: { requirementPrefix: 'REQ-CONFIG-' },
      codePaths: ['src/config-validation.ts', 'src/runner/engine.ts'],
      rubrics: {
        needsATarget: noul(
          'Does the code satisfy REQ-CONFIG-01: a configuration that declares no target is rejected?'
        ),
        assertionBelongsToRubric: noul(
          'Does the code satisfy REQ-CONFIG-02: an assertion whose key is not the name of a rubric of the same target is rejected?'
        ),
        optionsFitRubricType: noul(
          'Does the code satisfy REQ-CONFIG-03: an assertion option that does not belong to the type of its rubric, such as a score threshold on a yes/no rubric, is rejected?'
        ),
        thresholdsInRange: noul(
          'Does the code satisfy REQ-CONFIG-04: a probability or confidence threshold outside the range from 0 to 1 is rejected, and so is a score threshold outside the levels of its rubric?'
        ),
        reportsEveryProblem: noul(
          'Does the code satisfy REQ-CONFIG-05: validation collects every problem it finds and reports them together, each with the path of the offending entry in the configuration?'
        ),
        validatesFirst: noul(
          'Does the code satisfy REQ-CONFIG-06: a run validates the configuration before it reads a spec, reads code or creates the client of the API?'
        ),
      },
      assertions: {
        needsATarget: MET,
        assertionBelongsToRubric: MET,
        optionsFitRubricType: MET,
        thresholdsInRange: MET,
        reportsEveryProblem: MET,
        validatesFirst: MET,
      },
    },

    answers: {
      description: 'An answer that cannot be read fails the check',
      specPath: 'docs/specs/fail-closed.md',
      specFilter: { requirementPrefix: 'REQ-ANSWER-' },
      codePaths: ['src/runner/assertion-runner.ts', 'src/runner/engine.ts'],
      rubrics: {
        nonFiniteFails: noul(
          'Does the code satisfy REQ-ANSWER-01: when the probability, the confidence or the score of an answer is not a finite number, the assertion on that answer fails?'
        ),
        missingAnswerFails: noul(
          'Does the code satisfy REQ-ANSWER-02: when the evaluator returns no answer for a rubric, the check of that target fails?'
        ),
        noAssertionIsInformational: noul(
          'Does the code satisfy REQ-ANSWER-03: a rubric that has no assertion is reported with its answer and does not affect whether the check passes?'
        ),
      },
      assertions: {
        nonFiniteFails: MET,
        missingAnswerFails: MET,
        noAssertionIsInformational: MET,
      },
    },

    paths: {
      description: 'Files are read only from inside the project root',
      specPath: 'docs/specs/security.md',
      specFilter: { requirementPrefix: 'REQ-PATH-' },
      codePaths: ['src/context/path-security.ts', 'src/context/glob-matcher.ts'],
      rubrics: {
        resolvesInsideRoot: noul(
          'Does the code satisfy REQ-PATH-01: a path is accepted only when its real path, with symbolic links resolved, lies inside the project root, and any other path is rejected with an error?'
        ),
        globsStayRelative: noul(
          'Does the code satisfy REQ-PATH-02: a glob pattern that is absolute, or that contains a ".." segment, is rejected before any file is matched?'
        ),
        followsSymlinks: noul(
          'Does the code violate REQ-PATH-03 by following symbolic links while it matches files against glob patterns?'
        ),
        excludesSecrets: noul(
          'Does the code satisfy REQ-PATH-04: environment files, the .git directory and private key files are excluded from every match, whatever the patterns of a target say?'
        ),
      },
      assertions: {
        resolvesInsideRoot: MET,
        globsStayRelative: MET,
        followsSymlinks: NOT_VIOLATED,
        excludesSecrets: MET,
      },
    },

    git: {
      description: 'git is started safely with an untrusted revision range',
      specPath: 'docs/specs/security.md',
      specFilter: { requirementPrefix: 'REQ-GIT-' },
      codePaths: ['src/context/git-revision.ts', 'src/context/git-diff.ts'],
      rubrics: {
        startsGitThroughShell: noul(
          'Does the code violate REQ-GIT-01 by starting git through a shell, or by building a shell command line from its arguments?'
        ),
        validatesRevisionRange: noul(
          'Does the code satisfy REQ-GIT-02: a revision range that is empty, that starts with "-", or that contains a character outside letters, digits and the punctuation of git revisions is rejected before git is started?'
        ),
        rangeIsNotAnOption: noul(
          'Does the code satisfy REQ-GIT-03: the revision range is passed to git after "--end-of-options" and is followed by "--"?'
        ),
      },
      assertions: {
        startsGitThroughShell: NOT_VIOLATED,
        validatesRevisionRange: MET,
        rangeIsNotAnOption: MET,
      },
    },
  },
});
