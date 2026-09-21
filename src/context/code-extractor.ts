import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { extractGitDiff, listStagedFiles, readStagedFile } from './git-diff.js';
import { matchesGlobPatterns, resolveGlobPatterns } from './glob-matcher.js';
import {
  assertInsideRoot,
  MAX_FILE_COUNT,
  MAX_FILE_SIZE_BYTES,
  PathSecurityError,
  validateGlobPattern,
} from './path-security.js';
import type { CodeExtractionOptions, GitDiffOptions } from './types.js';

export interface CodeFileContext {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly content: string;
  readonly lineCount: number;
  readonly source: 'file';
}

export interface ExtractedCodeContext {
  readonly files: readonly CodeFileContext[];
  readonly combinedPromptContext: string;
  readonly totalLines: number;
  /** `diff` when a diff decided whether the target is part of the run. The content is always whole files. */
  readonly mode: 'full' | 'diff';
  /** True when the combined context was cut at the character budget. */
  readonly truncated: boolean;
  /** Diff run only: the changed files that belong to the target. Empty when the target is skipped. */
  readonly changedFiles?: readonly string[];
}

const DEFAULT_MAX_CHARS = 120_000;

async function readFileWithinLimits(
  absolutePath: string,
  relativePath: string
): Promise<CodeFileContext | null> {
  const stat = await fs.stat(absolutePath);
  if (!stat.isFile()) {
    return null;
  }
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    return null;
  }

  const content = await fs.readFile(absolutePath, 'utf-8');
  const lines = content.split('\n');
  return {
    relativePath,
    absolutePath,
    content,
    lineCount: lines.length,
    source: 'file',
  };
}

/**
 * Reads the code of a target.
 *
 * In a diff run (`--staged`, `--diff`) the diff only decides whether the target is part of the
 * run: a target none of whose files changed comes back empty and is skipped. A target that was
 * touched is read in full, exactly as in a full run. Rubrics ask about the target as a whole, and
 * what they ask about is usually outside the changed hunks.
 */
export async function extractCodeContext(
  filePatterns: readonly string[],
  options: CodeExtractionOptions = {}
): Promise<ExtractedCodeContext> {
  const cwd = options.cwd ?? process.cwd();
  const maxChars = options.maxTotalChars ?? DEFAULT_MAX_CHARS;

  const gitDiff = options.gitDiff;
  if (gitDiff?.staged || gitDiff?.diffRange) {
    const changedFiles = await changedFilesMatching(filePatterns, cwd, gitDiff);
    if (changedFiles.length === 0) {
      return { ...buildExtractedContext([], 'diff', maxChars), changedFiles };
    }
    // A staged run judges what is about to be committed. After `git add -p` the working tree
    // holds something else.
    const files = gitDiff.staged
      ? await readStagedFiles(filePatterns, cwd)
      : await readMatchingFiles(filePatterns, cwd);
    return { ...buildExtractedContext(files, 'diff', maxChars), changedFiles };
  }

  return buildExtractedContext(await readMatchingFiles(filePatterns, cwd), 'full', maxChars);
}

async function readMatchingFiles(
  filePatterns: readonly string[],
  cwd: string
): Promise<CodeFileContext[]> {
  const resolvedPaths = await resolveGlobPatterns(filePatterns, cwd);
  if (resolvedPaths.length > MAX_FILE_COUNT) {
    throw new PathSecurityError(
      `File count ${resolvedPaths.length} exceeds maximum of ${MAX_FILE_COUNT} per target`
    );
  }

  const files: CodeFileContext[] = [];

  for (const relPath of resolvedPaths) {
    try {
      const absolutePath = await assertInsideRoot(cwd, relPath);
      const fileContext = await readFileWithinLimits(absolutePath, relPath);
      if (fileContext) {
        files.push(fileContext);
      }
    } catch {
      // Skip unreadable or out-of-root paths
    }
  }

  return files;
}

/** The files of the target as they are staged in the git index. */
async function readStagedFiles(
  filePatterns: readonly string[],
  cwd: string
): Promise<CodeFileContext[]> {
  for (const pattern of filePatterns) {
    validateGlobPattern(pattern.startsWith('!') ? pattern.slice(1) : pattern);
  }

  const staged = (await listStagedFiles(cwd)).filter((relativePath) =>
    matchesGlobPatterns(relativePath, filePatterns)
  );
  if (staged.length > MAX_FILE_COUNT) {
    throw new PathSecurityError(
      `File count ${staged.length} exceeds maximum of ${MAX_FILE_COUNT} per target`
    );
  }

  const files: CodeFileContext[] = [];
  for (const relativePath of staged) {
    const content = await readStagedFile(relativePath, cwd, MAX_FILE_SIZE_BYTES);
    if (content === null) {
      continue;
    }
    files.push({
      relativePath,
      absolutePath: path.resolve(cwd, relativePath),
      content,
      lineCount: content.split('\n').length,
      source: 'file',
    });
  }
  return files;
}

/** The files of the diff, deleted ones included, that belong to the target. */
async function changedFilesMatching(
  filePatterns: readonly string[],
  cwd: string,
  gitDiff: GitDiffOptions
): Promise<string[]> {
  const diff = await extractGitDiff(gitDiff, cwd);
  return diff.files
    .map((file) => file.relativePath)
    .filter((relativePath) => matchesGlobPatterns(relativePath, filePatterns));
}

function buildExtractedContext(
  files: CodeFileContext[],
  mode: 'full' | 'diff',
  maxChars: number
): ExtractedCodeContext {
  let combinedPromptContext = files
    .map((file) => `--- File: ${file.relativePath} ---\n${file.content}`)
    .join('\n\n');

  const truncated = combinedPromptContext.length > maxChars;
  if (truncated) {
    combinedPromptContext = `${combinedPromptContext.slice(0, maxChars)}\n\n[... truncated for token budget ...]`;
  }

  const totalLines = files.reduce((acc, file) => acc + file.lineCount, 0);

  return {
    files,
    combinedPromptContext,
    totalLines,
    mode,
    truncated,
  };
}

/**
 * Backward-compatible helper for explicit file path lists.
 */
export async function extractCodeFromPaths(
  filePaths: readonly string[],
  cwd: string = process.cwd()
): Promise<ExtractedCodeContext> {
  if (filePaths.length > MAX_FILE_COUNT) {
    throw new PathSecurityError(
      `File count ${filePaths.length} exceeds maximum of ${MAX_FILE_COUNT} per target`
    );
  }

  const files: CodeFileContext[] = [];

  for (const relPath of filePaths) {
    try {
      const absolutePath = await assertInsideRoot(cwd, relPath);
      const fileContext = await readFileWithinLimits(absolutePath, relPath);
      if (fileContext) {
        files.push(fileContext);
      }
    } catch (error: unknown) {
      if (error instanceof PathSecurityError) {
        throw error;
      }
      // Skip unreadable paths
    }
  }

  return buildExtractedContext(files, 'full', DEFAULT_MAX_CHARS);
}
