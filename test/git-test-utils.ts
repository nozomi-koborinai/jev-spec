import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

export interface TempGitRepo {
  readonly dir: string;
  git(...args: string[]): string;
  write(relativePath: string, content: string): Promise<void>;
  cleanup(): Promise<void>;
}

/**
 * Creates an isolated git repository in the OS temp directory.
 * Identity and signing are pinned so the developer's global git config cannot break commits.
 */
export async function createTempGitRepo(prefix = 'jev-spec-git-'): Promise<TempGitRepo> {
  const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), prefix)));

  const git = (...args: string[]): string =>
    execFileSync(
      'git',
      [
        '-c', 'user.name=jev-spec-test',
        '-c', 'user.email=test@jev-spec.invalid',
        '-c', 'commit.gpgsign=false',
        ...args,
      ],
      { cwd: dir, encoding: 'utf-8' }
    );

  const write = async (relativePath: string, content: string): Promise<void> => {
    const target = path.join(dir, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf-8');
  };

  git('init', '--quiet', '--initial-branch=main');

  return {
    dir,
    git,
    write,
    cleanup: () => fs.rm(dir, { recursive: true, force: true }),
  };
}
