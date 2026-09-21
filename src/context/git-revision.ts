export const GIT_DIFF_TIMEOUT_MS = 15_000;

const GIT_REVISION_PATTERN = /^[A-Za-z0-9._/~^:@-]+$/;

export class GitRevisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitRevisionError';
  }
}

/**
 * Validates a git revision range before passing it to git diff.
 * Rejects option injection (arguments starting with '-') and shell metacharacters.
 */
export function assertGitRevision(range: string): void {
  const trimmed = range.trim();

  if (!trimmed) {
    throw new GitRevisionError('Git revision range must not be empty');
  }

  if (trimmed.startsWith('-')) {
    throw new GitRevisionError(`Git revision range must not start with "-": "${trimmed}"`);
  }

  if (!GIT_REVISION_PATTERN.test(trimmed)) {
    throw new GitRevisionError(`Git revision range contains invalid characters: "${trimmed}"`);
  }
}
