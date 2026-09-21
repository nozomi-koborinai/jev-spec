import type { CheckCliOptions } from './commands/check.js';

export type ParsedCli =
  | { readonly kind: 'help' }
  | { readonly kind: 'version' }
  | { readonly kind: 'check'; readonly options: CheckCliOptions };

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

export const USAGE = `Usage: jev-spec check [options]

Options:
  -c, --config <file>    Path to the configuration file (default: jev-spec.config.{ts,js,mjs})
  -z, --zone <name>      Verify a single zone
      --staged           Verify staged git changes only
      --diff [range]     Verify a git diff range (default: HEAD), e.g. origin/main...HEAD
  -f, --format <format>  Output format: terminal (default), markdown, json
  -o, --output <file>    Write the report to a file inside the project root
      --mock             Use the offline mock evaluator (no API key, results are not real)
  -h, --help             Show this help
  -v, --version          Show the jev-spec version

Exit codes: 0 = passed, 1 = verification failed, 2 = configuration or runtime error`;

const FORMATS = ['terminal', 'markdown', 'json'] as const;

type ValueOptionKey = 'config' | 'zone' | 'format' | 'output';

const VALUE_OPTIONS: Readonly<Record<string, ValueOptionKey>> = {
  '--config': 'config',
  '-c': 'config',
  '--zone': 'zone',
  '-z': 'zone',
  '--format': 'format',
  '-f': 'format',
  '--output': 'output',
  '-o': 'output',
};

/**
 * Splits "--name=value" into ["--name", "value"] so both spellings share one code path.
 */
function expandEquals(args: readonly string[]): string[] {
  return args.flatMap((arg) => {
    const separator = arg.indexOf('=');
    if (arg.startsWith('--') && separator > 2) {
      return [arg.slice(0, separator), arg.slice(separator + 1)];
    }
    return [arg];
  });
}

function isFormat(value: string): value is (typeof FORMATS)[number] {
  return (FORMATS as readonly string[]).includes(value);
}

/**
 * Parses CLI arguments strictly: unknown commands, unknown options, missing values and
 * invalid values are errors rather than being silently ignored.
 */
export function parseCliArgs(argv: readonly string[]): ParsedCli {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { kind: 'help' };
  }
  if (argv.includes('--version') || argv.includes('-v')) {
    return { kind: 'version' };
  }

  const args = expandEquals(argv);
  const values: Partial<Record<ValueOptionKey, string>> = {};
  let command: string | undefined;
  let staged = false;
  let mock = false;
  let diff: string | true | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg.startsWith('-')) {
      if (command !== undefined) {
        throw new CliUsageError(`Unexpected argument "${arg}"`);
      }
      if (arg !== 'check') {
        throw new CliUsageError(`Unknown command "${arg}"`);
      }
      command = arg;
      continue;
    }

    if (arg === '--staged') {
      staged = true;
      continue;
    }

    if (arg === '--mock') {
      mock = true;
      continue;
    }

    if (arg === '--diff') {
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        diff = next;
        i++;
      } else {
        diff = true;
      }
      continue;
    }

    const key = VALUE_OPTIONS[arg];
    if (key === undefined) {
      throw new CliUsageError(`Unknown option "${arg}"`);
    }

    const value = args[i + 1];
    if (value === undefined || value === '' || value.startsWith('-')) {
      throw new CliUsageError(`Option "${arg}" requires a value`);
    }
    values[key] = value;
    i++;
  }

  if (staged && diff !== undefined) {
    throw new CliUsageError('Options "--staged" and "--diff" cannot be combined');
  }

  if (values.format !== undefined && !isFormat(values.format)) {
    throw new CliUsageError(
      `Unsupported format "${values.format}". Expected one of: ${FORMATS.join(', ')}`
    );
  }

  const options: CheckCliOptions = {
    ...(values.config !== undefined && { config: values.config }),
    ...(values.zone !== undefined && { zone: values.zone }),
    ...(values.format !== undefined && { format: values.format as (typeof FORMATS)[number] }),
    ...(values.output !== undefined && { output: values.output }),
    ...(staged && { staged: true }),
    ...(diff !== undefined && { diff }),
    ...(mock && { mock: true }),
  };

  return { kind: 'check', options };
}
