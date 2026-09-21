# Security Policy

The `jev-spec` maintainers take the security of our software, dependencies, and users seriously. This document outlines our vulnerability reporting policy, threat model, and built-in security architecture.

---

## Reporting a Vulnerability

If you discover or suspect a security vulnerability in `jev-spec`, please **do not** open a public issue on GitHub.

Instead, please report the vulnerability through one of the following responsible disclosure channels:

- **GitHub Private Vulnerability Reporting**: Submit a private advisory directly via the repository's Security tab (if available).
- **Direct Maintainer Contact**: Send encrypted or confidential details to `security@koborin.ai` (or contact Nozomi Koborinai).

### What to Include in Your Report

To help us triage and resolve the issue quickly, please provide:

1. **Description**: Clear description of the vulnerability, potential impact, and target component.
2. **Steps to Reproduce**: Minimal reproduction script, configuration file (`jev-spec.config.ts`), or proof-of-concept repository.
3. **Affected Versions**: Versions of `jev-spec` and Node.js environment where the issue was reproduced.
4. **Remediation Ideas**: Any proposed patches or mitigations, if known.

We will acknowledge receipt of your vulnerability report within 48 hours and provide regular updates regarding validation, patch development, and advisory coordination.

---

## Threat Model & Security Boundaries

`jev-spec` is a developer tool and CI gate used to verify source code and markdown specifications against semantic rubrics using the TypeSafe AI Jev System 1 model.

Because `jev-spec` operates inside developer environments and CI/CD pipelines where external code may be evaluated, we establish strict trust boundaries.

### Trust Assumptions

| Component | Trust Level | Description |
| :--- | :--- | :--- |
| **CLI Invocation** | Trusted | Flags passed by the developer or workflow runner (`--target`, `--config`, etc.). |
| **Configuration File** | High Privilege | `jev-spec.config.ts` is executable TypeScript/JavaScript. In CI, it must originate from trusted branches or require maintainer review. |
| **API Credentials** | Confidential | `TYPESAFE_AI_API_KEY` must never be leaked, committed, or exposed to unreviewed pull requests. |
| **Source Code & Git Diffs** | Untrusted | In pull request evaluation, source files and the paths named by a diff may contain malicious payloads, symlinks, or prompt injections. |
| **Specifications (Markdown)** | Untrusted / Semi-Trusted | Specifications may originate from external contributors and could contain adversarial formatting or text. |

---

## Built-in Security Hardening

`jev-spec` implements comprehensive defensive measures (Hardening fixes S-01 through S-05) to ensure execution integrity:

### 1. Workspace Root Jail & Path Traversal Protection (S-01 / S-02)

- **Path Resolution Jail**: All file references (`specPath`, `codePaths`, `--output`, and glob patterns) are resolved to absolute canonical paths (`fs.realpath`) and verified to reside strictly within the project root directory (`cwd`) via `assertInsideRoot()`.
- **Symlink Escaping Prevention**: Glob matcher disables `followSymbolicLinks: false`, preventing attackers from creating symlinks to sensitive host files (e.g., `/etc/passwd`, `~/.ssh/id_rsa`, or environment secret files).
- **Glob Pattern Validation**: Include and ignore patterns rejecting leading `/` absolute paths and directory traversal (`..`) segments are enforced before file matching begins.
- **Sensitive File Exclusion**: Patterns matching `.env*`, `.git/**`, and private key formats are excluded by default from automated scans.

### 2. Git Diff Argument Sanitization (S-03)

- **Safe Command Invocation**: Git diff execution is handled strictly via `child_process.execFile('git', args)` without an intermediary shell, eliminating shell command injection.
- **Revision Sanitization**: The `--diff <range>` parameter is strictly validated (`assertGitRevision()`) against allowed revision syntax (`[A-Za-z0-9._/~^:-]`). Arguments starting with `-` (such as `--output=/path` or `--no-index`) are rejected to prevent file creation or truncation.
- **Argument Delimiters**: Option parsing is terminated with `--end-of-options` before the user-provided revision range, and the range is followed by `--` so it can never be read as an option or a pathspec.
- **Execution Timeouts**: A hard 15-second timeout is enforced on all git diff executions to avoid runner deadlocks on corrupted repositories.

### 3. Prompt Boundaries (S-04, best effort)

- **Context Boundaries**: Code and specification text sent to TypeSafe AI Jev are wrapped in explicit, structural boundary tags:

  ```xml
  <specification_context verbatim="true">
  ...
  </specification_context>

  <untrusted_source_code verbatim="true">
  ...
  </untrusted_source_code>
  ```

- **Framing Note**: The `specification` field of the state starts with a note that asks the model to judge only the functional behaviour of the code against the specification, and to ignore instructions, override markers and claims of compliance embedded in comments or prose.
- **Limits**: This is a mitigation, not a guarantee. TypeSafe documents that content written to steer the model, including text that argues for its own classification, [can move the answer](https://docs.typesafe.ai/model-jaggedness/jev-1.13#adversarial-content), and jev-spec has no measurement that shows the tags or the note prevent it. A comment that claims compliance is such text. Treat a pass on code you do not trust as weak evidence, and keep human review for it.

### 4. Base URL SSRF & Credential Leak Protection (S-05)

- **Endpoint Whitelisting**: By default, `jev-spec` routes all API traffic exclusively to the official TypeSafe AI endpoint (`https://api.typesafe.ai`).
- **SSRF Prevention**: Specifying a custom `client.baseUrl` in `jev-spec.config.ts` or CLI options is blocked unless explicitly enabled via `allowCustomBaseUrl: true`. This prevents rogue pull requests from redirecting `Authorization: Bearer <API_KEY>` headers to an attacker-controlled listener.

### 5. Resource Limits & DoS Prevention

- **File Read Bounds**: Individual source files exceeding 2 MB are skipped to prevent memory exhaustion (OOM).
- **File Count Quota**: A maximum of 500 files is enforced per target.
- **Prompt Token Budget**: Cumulative context size is bounded to prevent unbounded token costs or timeout errors.

---

## Best Practices for CI/CD Pipelines

1. **Never pass API keys to untrusted pull requests**:
   Do not inject `TYPESAFE_AI_API_KEY` in `on: pull_request` workflows from external forks without maintainer approval. Use GitHub Actions Environment Protection Rules or execute in mock mode for external PRs.
2. **Never hardcode API keys**:
   Do not commit API keys to version control or hardcode them in `jev-spec.config.ts`. Always supply them through environment variables (`TYPESAFE_AI_API_KEY`).
3. **Pin Dependencies**:
   Use package lockfiles (`package-lock.json`) and automated vulnerability auditing (`npm audit`) to ensure supply-chain integrity.
