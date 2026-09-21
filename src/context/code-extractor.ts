import * as fs from 'node:fs/promises';
import { extractGitDiff, formatDiffContext } from './git-diff.js';
import { matchesGlobPatterns, resolveGlobPatterns } from './glob-matcher.js';
import {
  assertInsideRoot,
  MAX_FILE_COUNT,
  MAX_FILE_SIZE_BYTES,
  PathSecurityError,
} from './path-security.js';
import type { CodeExtractionOptions, GitDiffOptions } from './types.js';

export interface CodeFileContext {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly content: string;
  readonly lineCount: number;
  readonly source: 'file' | 'diff';
}

export interface ExtractedCodeContext {
  readonly files: readonly CodeFileContext[];
  readonly combinedPromptContext: string;
  readonly totalLines: number;
  readonly mode: 'full' | 'diff';
  /** True when the combined context was cut at the character budget. */
  readonly truncated: boolean;
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
 * Resolves paths and extracts code content from files or git diffs.
 */
export async function extractCodeContext(
  filePatterns: readonly string[],
  options: CodeExtractionOptions = {}
): Promise<ExtractedCodeContext> {
  const cwd = options.cwd ?? process.cwd();
  const maxChars = options.maxTotalChars ?? DEFAULT_MAX_CHARS;

  const gitDiff = options.gitDiff;
  if (gitDiff?.staged || gitDiff?.diffRange) {
    return extractFromGitDiff(filePatterns, cwd, gitDiff, options.contextLines, maxChars);
  }

  const resolvedPaths = await resolveGlobPatterns(filePatterns, cwd);
  if (resolvedPaths.length > MAX_FILE_COUNT) {
    throw new PathSecurityError(
      `File count ${resolvedPaths.length} exceeds maximum of ${MAX_FILE_COUNT} per zone`
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

  return buildExtractedContext(files, 'full', maxChars);
}

async function extractFromGitDiff(
  filePatterns: readonly string[],
  cwd: string,
  gitDiff: GitDiffOptions,
  contextLines: number | undefined,
  maxChars: number
): Promise<ExtractedCodeContext> {
  const diff = await extractGitDiff(gitDiff, cwd, contextLines);
  const matched = diff.files.filter((file) => matchesGlobPatterns(file.relativePath, filePatterns));

  if (matched.length > MAX_FILE_COUNT) {
    throw new PathSecurityError(
      `Diff file count ${matched.length} exceeds maximum of ${MAX_FILE_COUNT} per zone`
    );
  }

  const files: CodeFileContext[] = [];
  for (const file of matched) {
    try {
      const absolutePath = await assertInsideRoot(cwd, file.relativePath);
      files.push({
        relativePath: file.relativePath,
        absolutePath,
        content: file.formattedDiff,
        lineCount: file.hunks.reduce((acc, hunk) => acc + hunk.lineCount, 0),
        source: 'diff' as const,
      });
    } catch {
      // Skip diff entries outside project root
    }
  }

  if (files.length === 0 && diff.rawDiff.trim()) {
    return {
      files: [],
      combinedPromptContext: formatDiffContext([]),
      totalLines: 0,
      mode: 'diff',
      truncated: false,
    };
  }

  return buildExtractedContext(files, 'diff', maxChars, formatDiffContext(matched));
}

function buildExtractedContext(
  files: CodeFileContext[],
  mode: 'full' | 'diff',
  maxChars: number,
  diffFormatted?: string
): ExtractedCodeContext {
  let combinedPromptContext =
    mode === 'diff' && diffFormatted !== undefined
      ? diffFormatted
      : files.map((file) => `--- File: ${file.relativePath} ---\n${file.content}`).join('\n\n');

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
      `File count ${filePaths.length} exceeds maximum of ${MAX_FILE_COUNT} per zone`
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
