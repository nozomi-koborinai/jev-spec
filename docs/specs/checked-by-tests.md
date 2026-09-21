# Requirements checked by tests only

These requirements are as binding as the others, but no target of `jev-spec.config.ts` covers them. For each one, no wording of a question made the model tell the intact code from a copy in which the requirement was broken (see `docs/probe-results.md`). Each needs more than reading: following a value through a function, knowing what a regular expression accepts, or seeing what it means to pass one list instead of another to a function. Tests whose titles start with the ID pin them instead.

## Answers

### REQ-ANSWER-02: A missing answer fails the check

When the evaluator returns no answer for a rubric, the check of that target fails.

## Git

### REQ-GIT-02: A revision range is validated before git is started

A revision range that is empty, that starts with `-`, or that contains a character outside letters, digits and the punctuation of git revisions is rejected before git is started.

## Diff runs

### REQ-READ-01: A touched target is read in full

In a diff run, a target with at least one changed code file is checked on the whole content of all its code files, exactly as in a full run.
