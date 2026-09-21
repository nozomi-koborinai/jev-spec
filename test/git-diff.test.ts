import { describe, test as it, before, after } from 'node:test';
import { expect } from './test-utils.js';
import { createTempGitRepo, type TempGitRepo } from './git-test-utils.js';
import { extractGitDiff } from '../src/context/git-diff.js';

describe('extractGitDiff against a real git repository', () => {
  let repo: TempGitRepo;

  before(async () => {
    repo = await createTempGitRepo();
    await repo.write('src/a.ts', 'export const a = 1;\n');
    repo.git('add', '-A');
    repo.git('commit', '--quiet', '-m', 'init');

    repo.git('checkout', '--quiet', '-b', 'feature');
    await repo.write('src/a.ts', 'export const a = 1;\nexport const b = 2;\n');
    repo.git('commit', '--quiet', '-am', 'add b');
  });

  after(async () => {
    await repo.cleanup();
  });

  it('returns the files changed in a revision range', async () => {
    const diff = await extractGitDiff({ diffRange: 'main...HEAD' }, repo.dir);

    expect(diff.changedPaths).toEqual(['src/a.ts']);
    expect(diff.files[0].formattedDiff).toContain('+export const b = 2;');
  });

  it('returns staged changes', async () => {
    await repo.write('src/staged.ts', 'export const staged = true;\n');
    repo.git('add', 'src/staged.ts');

    const diff = await extractGitDiff({ staged: true }, repo.dir);

    expect(diff.changedPaths).toEqual(['src/staged.ts']);
    expect(diff.files[0].status).toBe('added');

    repo.git('reset', '--quiet', 'src/staged.ts');
  });
});
