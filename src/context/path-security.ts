import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
export const MAX_FILE_COUNT = 500;

export const DEFAULT_SENSITIVE_IGNORE_PATTERNS = [
  '**/.env',
  '**/.env.*',
  '**/.git/**',
  '**/*.pem',
  '**/*.key',
  '**/id_rsa',
  '**/id_ed25519',
] as const;

export class PathSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathSecurityError';
  }
}

/**
 * Validates glob patterns before matching. Rejects absolute paths and traversal segments.
 */
export function validateGlobPattern(pattern: string): void {
  const normalized = pattern.replace(/\\/g, '/');

  if (normalized.startsWith('/')) {
    throw new PathSecurityError(`Glob pattern must be relative to project root: "${pattern}"`);
  }

  const segments = normalized.split('/');
  for (const segment of segments) {
    if (segment === '..') {
      throw new PathSecurityError(`Glob pattern must not contain ".." segments: "${pattern}"`);
    }
  }
}

/**
 * Resolves a path to its canonical form and confirms it resides inside the project root.
 * Symlinks are not followed beyond the resolved real path.
 */
export async function assertInsideRoot(root: string, targetPath: string): Promise<string> {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(resolvedRoot, targetPath);

  let canonicalRoot: string;
  try {
    canonicalRoot = await fs.realpath(resolvedRoot);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PathSecurityError(`Failed to resolve project root "${root}": ${message}`);
  }

  let canonicalTarget = resolvedTarget;
  try {
    canonicalTarget = await fs.realpath(resolvedTarget);
  } catch {
    // Target may not exist yet (e.g. --output). Resolve via nearest existing ancestor.
    let ancestor = resolvedTarget;
    let found = false;

    while (!found) {
      try {
        canonicalTarget = path.resolve(
          await fs.realpath(ancestor),
          path.relative(ancestor, resolvedTarget)
        );
        found = true;
      } catch {
        const parent = path.dirname(ancestor);
        if (parent === ancestor) {
          throw new PathSecurityError(`Failed to resolve path "${targetPath}" within project root`);
        }
        ancestor = parent;
      }
    }
  }

  const relative = path.relative(canonicalRoot, canonicalTarget);
  const isInside = relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));

  if (!isInside) {
    throw new PathSecurityError(
      `Path "${targetPath}" resolves outside project root "${resolvedRoot}"`
    );
  }

  return canonicalTarget;
}

/**
 * Synchronous variant for callers that already hold canonical paths.
 */
export function assertInsideRootSync(root: string, canonicalTarget: string): string {
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, canonicalTarget);
  const isInside = relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));

  if (!isInside) {
    throw new PathSecurityError(
      `Path "${canonicalTarget}" is outside project root "${resolvedRoot}"`
    );
  }

  return canonicalTarget;
}
