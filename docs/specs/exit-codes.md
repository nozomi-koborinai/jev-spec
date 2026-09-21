# Exit codes

The exit code of `jev-spec check` is its contract with hooks and CI. It tells them whether the gate passed, whether it failed, or whether it could not be evaluated at all. The three cases never share a code.

## Requirements

### REQ-EXIT-01: A run in which every check passes exits with 0

When every target that was checked passes, the check command exits with code 0.

### REQ-EXIT-02: A violated assertion exits with 1

When at least one assertion of a checked target is violated, the check command exits with code 1. Code 1 has no other meaning.

### REQ-EXIT-03: Every error exits with 2

When a run cannot be carried out, the command prints the error and exits with code 2. This holds for a usage error, an invalid configuration, a missing file, a missing API key and an unexpected internal error alike.

### REQ-EXIT-04: Help and version exit with 0 without a configuration

`--help` prints the usage text and `--version` prints the version. Both exit with code 0, and neither loads a configuration file.
