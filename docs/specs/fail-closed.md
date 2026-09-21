# Fail closed

jev-spec is a gate. A mistake in the setup stops the run, and an answer that cannot be read fails the check. Neither may turn into a check that passes without having checked anything.

## Configuration

### REQ-CONFIG-01: A configuration declares at least one target

A configuration that declares no target is rejected.

### REQ-CONFIG-02: An assertion belongs to a rubric

An assertion whose key is not the name of a rubric of the same target is rejected. A misspelled key would otherwise leave that rubric without any condition.

### REQ-CONFIG-03: Assertion options fit the type of the rubric

An assertion option that does not belong to the type of its rubric is rejected, for example a score threshold on a yes/no rubric.

### REQ-CONFIG-04: Thresholds are in range

A probability threshold or a confidence threshold outside the range from 0 to 1 is rejected. A score threshold outside the levels of its rubric is rejected as well.

### REQ-CONFIG-05: Validation reports every problem at once

Validation collects every problem it finds and reports them together, each with the path of the offending entry in the configuration.

## Runs

### REQ-RUN-01: A run validates the configuration first

A run validates the configuration before it reads a spec, reads code or creates the client of the API.

## Answers

### REQ-ANSWER-01: A value that is not a finite number fails

When the probability, the confidence or the score of an answer is not a finite number, the assertion on that answer fails.

### REQ-ANSWER-03: A rubric without an assertion is informational

A rubric that has no assertion does not affect whether the check passes.
