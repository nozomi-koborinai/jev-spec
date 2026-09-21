import { CliUsageError, type ParsedCli, parseCliArgs, USAGE } from './args.js';
import { checkCommand } from './commands/check.js';
import { readPackageVersion } from './version.js';

/**
 * CLI entry point. Returns the process exit code.
 */
export async function main(argv: readonly string[]): Promise<number> {
  try {
    const parsed: ParsedCli = parseCliArgs(argv);

    if (parsed.kind === 'help') {
      console.log(USAGE);
      return 0;
    }

    if (parsed.kind === 'version') {
      console.log(await readPackageVersion());
      return 0;
    }

    return await checkCommand(parsed.options);
  } catch (error: unknown) {
    if (error instanceof CliUsageError) {
      console.error(`[jev-spec error] ${error.message}\n\n${USAGE}`);
      return 2;
    }
    // Exit code 1 means "a check failed" and nothing else. An error that escaped would make
    // Node exit with 1, so it is reported here and becomes 2 like every other error.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n[jev-spec error] ${message}`);
    return 2;
  }
}
