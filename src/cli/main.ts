import { parseCliArgs, CliUsageError, USAGE, type ParsedCli } from './args.js';
import { checkCommand } from './commands/check.js';
import { readPackageVersion } from './version.js';

/**
 * CLI entry point. Returns the process exit code.
 */
export async function main(argv: readonly string[]): Promise<number> {
  let parsed: ParsedCli;
  try {
    parsed = parseCliArgs(argv);
  } catch (error: unknown) {
    if (error instanceof CliUsageError) {
      console.error(`[jev-spec error] ${error.message}\n\n${USAGE}`);
      return 2;
    }
    throw error;
  }

  if (parsed.kind === 'help') {
    console.log(USAGE);
    return 0;
  }

  if (parsed.kind === 'version') {
    console.log(await readPackageVersion());
    return 0;
  }

  return checkCommand(parsed.options);
}
