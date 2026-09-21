import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { describe, test as it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { runChecks } from '../src/runner/engine.js';
import type { AnyRubric } from '../src/types.js';
import { expect } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '../..');
const specsDir = path.join(pkgRoot, 'docs', 'specs');
const testsDir = path.join(pkgRoot, 'test');

const REQUIREMENT_HEADING = /^### (REQ-[A-Z]+-\d{2}): \S.*$/;
const ANY_REQUIREMENT_ID = /REQ-[A-Z]+-\d+/g;

/** Whole-ID match, so that REQ-EXIT-01 is not found inside REQ-EXIT-010. */
function mentions(text: string, id: string): boolean {
  return new RegExp(`(?<![A-Za-z0-9_-])${id}(?![A-Za-z0-9_-])`).test(text);
}

function rubricText(rubric: AnyRubric): string {
  return rubric.type === 'noul' ? rubric.question : rubric.description;
}

async function readSpecs(): Promise<ReadonlyArray<{ file: string; text: string }>> {
  const files = (await fs.readdir(specsDir)).filter((name) => name.endsWith('.md')).sort();
  return Promise.all(
    files.map(async (file) => ({
      file,
      text: await fs.readFile(path.join(specsDir, file), 'utf-8'),
    }))
  );
}

/**
 * These tests read the real specs of this repository, so they assert structure only: editing a
 * requirement must never break them, while a requirement that nothing checks must.
 */
describe("jev-spec's own specs", () => {
  it('declares every requirement under its own heading, with an ID that is used once', async () => {
    const specs = await readSpecs();
    expect(specs.length > 0).toBe(true);

    const seen = new Map<string, string>();
    for (const { file, text } of specs) {
      const headings = text.split('\n').filter((line) => line.startsWith('### '));
      expect(headings.length > 0).toBe(true);

      for (const heading of headings) {
        const match = REQUIREMENT_HEADING.exec(heading);
        expect(match === null ? `${file}: malformed requirement heading "${heading}"` : '').toBe(
          ''
        );
        const id = (match as RegExpExecArray)[1];
        expect(seen.has(id) ? `${id} is declared in ${seen.get(id)} and in ${file}` : '').toBe('');
        seen.set(id, file);
      }

      // An ID outside a heading is a reference from one requirement to another; every
      // requirement must be readable on its own.
      const body = text
        .split('\n')
        .filter((line) => !line.startsWith('### '))
        .join('\n');
      expect([...new Set(body.match(ANY_REQUIREMENT_ID) ?? [])]).toEqual([]);
    }
  });

  it('passes a dry run of the repository configuration without a single warning', async () => {
    const config = await loadConfig(undefined, pkgRoot);
    const result = await runChecks(config, { cwd: pkgRoot, dryRun: true });

    expect(result.passed).toBe(true);
    expect(result.warnings ?? []).toEqual([]);
    expect(result.targets.length > 0).toBe(true);

    for (const target of result.targets) {
      expect(`${target.targetName}: ${(target.plan?.warnings ?? ['no plan']).join(' | ')}`).toBe(
        `${target.targetName}: `
      );
      expect((target.plan?.requirementIds.length ?? 0) > 0).toBe(true);
      expect(target.codeFiles.length > 0).toBe(true);
    }
  });

  it('links every requirement to a rubric or to a test title by its ID', async () => {
    const specs = await readSpecs();
    const ids = specs.flatMap(({ text }) =>
      text
        .split('\n')
        .map((line) => (REQUIREMENT_HEADING.exec(line) ?? [])[1])
        .filter((id): id is string => id !== undefined)
    );
    expect(ids.length > 0).toBe(true);

    const config = await loadConfig(undefined, pkgRoot);
    const rubricTexts = Object.values(config.targets).flatMap((target) =>
      Object.values(target.rubrics).map(rubricText)
    );

    const testFiles = (await fs.readdir(testsDir)).filter((name) => name.endsWith('.test.ts'));
    const testTitles: string[] = [];
    for (const file of testFiles) {
      const source = await fs.readFile(path.join(testsDir, file), 'utf-8');
      for (const match of source.matchAll(/\b(?:it|test)\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) {
        testTitles.push(match[2]);
      }
    }

    const unlinked = ids.filter(
      (id) =>
        !rubricTexts.some((text) => mentions(text, id)) &&
        !testTitles.some((title) => mentions(title, id))
    );
    expect(unlinked).toEqual([]);
  });

  it('checks every requirement that a target covers with a rubric that names it', async () => {
    const config = await loadConfig(undefined, pkgRoot);
    const result = await runChecks(config, { cwd: pkgRoot, dryRun: true });

    for (const target of result.targets) {
      expect(target.plan?.unreferencedRequirementIds ?? ['no plan']).toEqual([]);
    }
  });
});
