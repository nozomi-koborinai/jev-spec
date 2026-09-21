import * as path from 'node:path';
import { describe, test as it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { extractCodeContext } from '../src/context/code-extractor.js';
import { formatDiffContext, parseUnifiedDiff } from '../src/context/git-diff.js';
import { matchesGlobPatterns, resolveGlobPatterns } from '../src/context/glob-matcher.js';
import { expect } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '../..');

const SAMPLE_DIFF = `diff --git a/src/auth/session.ts b/src/auth/session.ts
index 1111111..2222222 100644
--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ -1,3 +1,4 @@
 export interface SessionPayload {
   userId: string;
+  role: string;
   tokenId: string;
 }
`;

describe('Git diff and code extraction', () => {
  it('parses unified diff output', () => {
    const files = parseUnifiedDiff(SAMPLE_DIFF);
    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe('src/auth/session.ts');
    expect(files[0].hunks.length).toBeGreaterThan(0);
    expect(formatDiffContext(files)).toContain('role: string');
  });

  it('resolves globs over the real sources and reads the files', async () => {
    const matches = await resolveGlobPatterns(['src/cli/**/*.ts'], pkgRoot);
    expect(matches.length).toBeGreaterThan(0);

    const context = await extractCodeContext(['src/cli/**/*.ts'], { cwd: pkgRoot });
    expect(context.mode).toBe('full');
    expect(context.files.length).toBeGreaterThan(0);
    expect(context.files.every((file) => file.relativePath.startsWith('src/cli/'))).toBe(true);
    expect(context.combinedPromptContext.length).toBeGreaterThan(0);
  });

  it('matches glob include and ignore patterns', () => {
    expect(matchesGlobPatterns('src/auth/session.ts', ['src/auth/**/*.ts'])).toBe(true);
    expect(
      matchesGlobPatterns('src/auth/session.test.ts', [
        'src/auth/**/*.ts',
        '!src/auth/**/*.test.ts',
      ])
    ).toBe(false);
  });
});
