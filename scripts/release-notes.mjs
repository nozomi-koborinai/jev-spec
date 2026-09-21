#!/usr/bin/env node
// Prints the GitHub Release body for a version tag: that version's section of CHANGELOG.md.
//
//   node scripts/release-notes.mjs v1.2.3 [--changelog CHANGELOG.md] [--package package.json]
//
// The release workflow runs this before `npm publish`, so everything that would make a release
// inconsistent stops the workflow before the irreversible step: a tag that does not match
// package.json, a changelog without a section for the version, or an empty section.

import { readFile } from 'node:fs/promises';

const VERSION_TAG = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

class ReleaseNotesError extends Error {}

function parseArgs(argv) {
  const options = { changelog: 'CHANGELOG.md', package: 'package.json' };
  let tag;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--changelog' || arg === '--package') {
      const value = argv[++i];
      if (value === undefined) {
        throw new ReleaseNotesError(`Option "${arg}" requires a value`);
      }
      options[arg.slice(2)] = value;
    } else if (arg.startsWith('-')) {
      throw new ReleaseNotesError(`Unknown option "${arg}"`);
    } else if (tag === undefined) {
      tag = arg;
    } else {
      throw new ReleaseNotesError(`Unexpected argument "${arg}"`);
    }
  }

  if (tag === undefined) {
    throw new ReleaseNotesError(
      'Usage: release-notes.mjs <tag> [--changelog <file>] [--package <file>]'
    );
  }
  return { tag, ...options };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns the body of the `## [version]` section: everything up to the next version heading or
 * the link reference definitions at the end of the file, without the heading itself.
 */
export function extractSection(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const heading = new RegExp(`^## \\[${escapeRegExp(version)}\\](?:\\s|$)`);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) {
    return undefined;
  }

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^## \[/.test(line) || /^\[[^\]]+\]:\s/.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

async function main() {
  const { tag, changelog, package: packagePath } = parseArgs(process.argv.slice(2));

  const match = VERSION_TAG.exec(tag);
  if (!match) {
    throw new ReleaseNotesError(`"${tag}" is not a version tag (expected vMAJOR.MINOR.PATCH)`);
  }
  const version = match[1];

  const manifest = JSON.parse(await readFile(packagePath, 'utf-8'));
  if (manifest.version !== version) {
    throw new ReleaseNotesError(
      `Tag ${tag} does not match the version in ${packagePath} (${manifest.version}). ` +
        'Bump the version before tagging.'
    );
  }

  const section = extractSection(await readFile(changelog, 'utf-8'), version);
  if (section === undefined) {
    throw new ReleaseNotesError(`${changelog} has no "## [${version}]" section`);
  }
  if (section === '') {
    throw new ReleaseNotesError(`The "## [${version}]" section of ${changelog} is empty`);
  }

  const notes = [
    section,
    '',
    '---',
    '',
    `Install: \`npm install -D ${manifest.name}@${version}\``,
    '',
  ];
  process.stdout.write(notes.join('\n'));
}

try {
  await main();
} catch (error) {
  if (error instanceof ReleaseNotesError) {
    console.error(`[release-notes] ${error.message}`);
    process.exit(1);
  }
  throw error;
}
