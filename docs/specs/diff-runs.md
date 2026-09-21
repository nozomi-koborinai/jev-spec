# Diff runs

`--staged` and `--diff` make a run cheap enough for a pre-commit hook by limiting it to what a change touches. The diff decides which targets are checked. It never decides how much of a target the model sees: a rubric asks about the target as a whole, and what it asks about is usually outside the changed lines.

## Choosing the targets

### REQ-DIFF-01: A target without changes is skipped

In a diff run, a target none of whose code files changed is skipped. Nothing of it is sent to the evaluator, its spec is not read, and it counts as neither passed nor failed.

### REQ-DIFF-02: A deleted file counts as a change

In a diff run, the changed files decide whether a target is skipped, not the files that are left. A target whose code files were all deleted is checked, not skipped.

### REQ-DIFF-03: A run that skips every target needs no API key

The evaluator is created when the first target is evaluated. A diff run in which every target is skipped therefore creates no evaluator, needs no API key and passes.

## Reading a chosen target

### REQ-READ-02: A staged run reads the staged content

In a run with `--staged`, the content of the files of a target is taken from the git index. The check judges what is about to be committed, which after a partial `git add` is not what the working tree holds.
