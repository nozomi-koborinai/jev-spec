# jev-spec

jev-spec checks source code against the requirements written in a Markdown spec and reports where the two have drifted apart. It puts typed questions to TypeSafe AI's Jev model and compares the answers with thresholds that the project owner sets. It does not judge the quality of the spec itself.

## Language

### Checking

**Check**:
A judgement of whether the code of a target satisfies the requirements of its spec, ending in passed or failed. The spec is the yardstick: a check asks whether the code satisfies a requirement, never the reverse.
_Avoid_: Verification, verify (a probability is not a proof), test

**Target**:
One part of a spec paired with the code that implements it, checked as a unit. Targets may overlap and may cut across modules.
_Avoid_: Zone (the former name), module, scope, suite

**Drift**:
A disagreement between a spec and the code that implements it, whatever its history: a requirement the code stopped satisfying, one it never satisfied, or behaviour that no requirement covers. It is what a failed check indicates, and it does not say which of the two is out of date.
_Avoid_: Regression, non-compliance, mismatch

**Unspecified behaviour**:
Observable behaviour of the code that no requirement covers. A kind of drift.
_Avoid_: Undocumented behaviour (that is about user documentation)

**Validation**:
Confirming that a setup is well formed (configuration, spec files, code paths) without checking anything.
_Avoid_: Check, verification

### Specs

**Spec**:
A Markdown document that states requirements in natural language.
_Avoid_: Docs, design doc, PRD

**Requirement**:
A single checkable claim in a spec, identified by an ID such as `REQ-AUTH-02` or `AC-GDPR-01`.
_Avoid_: Rule, criterion, acceptance criterion (not a separate concept: `AC-` is just another ID prefix)

### Judging

**Rubric**:
A question put to the model about a target, together with the shape of its answer: a yes/no probability (Noul), one of several options (Choice) or a position on ordered levels (Score). TypeSafe's documentation calls this unit a "question".
_Avoid_: Prompt, test

**Question**:
The sentence a rubric asks. Every rubric asks exactly one.
_Avoid_: Prompt, instruction

**Answer**:
What the model returns for a rubric: a probability, a choice or a score.
_Avoid_: Result, evaluation, verdict

**Assertion**:
The pass/fail condition placed on a rubric's answer. A rubric without an assertion is informational and cannot fail a check.
_Avoid_: Threshold (a threshold is a number inside an assertion), rule

**Violation**:
An answer that does not meet its assertion. One violation is enough to fail a check.
_Avoid_: Error, failure

**Gate**:
All assertions of a configuration taken together; they decide whether a run passes. Loosening the gate is the owner's decision.
_Avoid_: Policy, rules

**Calibrated**:
Said only of the model's probabilities: outcomes given a probability of 0.8 occur about 80% of the time.
_Avoid_: Using it for what the owner does to thresholds (see Tuning)

**Tuning**:
The owner's adjustment of thresholds to their own code.
_Avoid_: Calibration, calibrate

### Runs

**Run**:
One invocation of the check command: one check per selected target, ending in an exit code.
_Avoid_: Execution, job, verification

**Full run**:
A run that sends all the code of each target.

**Diff run**:
A run limited to changed code: only the changed hunks are sent to the model.
_Avoid_: Diff mode, staged mode

**Skipped**:
Said of a target whose check a diff run did not perform because none of its code changed. It counts as neither passed nor failed.

**Dry run**:
A validation of the whole setup that sends nothing to the model and produces no answers.
_Avoid_: Mock, offline check

**Mock**:
A run whose answers are placeholders produced locally. It is never evidence about the code.
_Avoid_: Dry run, offline check, test mode
