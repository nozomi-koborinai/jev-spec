import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, test as it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildSectionsFromAst,
  extractRequirementIds,
  extractTags,
  filterSections,
  loadSpec,
  parseMarkdownAst,
  parseMarkdownSections,
  SpecFilterError,
} from '../src/parser/markdown-parser.js';
import { OWN_REQUIREMENT_PREFIX, OWN_SPEC_PATH, ownRequirementIds } from './own-project.js';
import { expect } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '../..');

describe('Markdown Spec Parser', () => {
  it('extracts REQ and AC requirement IDs', () => {
    const text = 'REQ-AUTH-01 and AC-GDPR-02 with REQ-DATA_02';
    const ids = extractRequirementIds(text);
    expect(ids).toContain('REQ-AUTH-01');
    expect(ids).toContain('AC-GDPR-02');
    expect(ids).toContain('REQ-DATA_02');
  });

  it('extracts hashtag tags', () => {
    const tags = extractTags('Security notes #auth #compliance');
    expect(tags).toContain('auth');
    expect(tags).toContain('compliance');
  });

  it('parses markdown sections via mdast', () => {
    const markdown = `# Title
Intro text

## REQ-01 Section
Details for REQ-01.

## REQ-02 Section
Details for REQ-02.
`;
    const sections = parseMarkdownSections(markdown);
    expect(sections.length).toBeGreaterThanOrEqual(2);
    expect(sections.some((section) => section.title.includes('REQ-01'))).toBe(true);
  });

  it('filters sections by heading, tag, and requirement prefix', () => {
    const tree = parseMarkdownAst(`# Overview

## Authentication
REQ-AUTH-01 details. #auth

## Billing
REQ-BILL-01 details. #billing
`);
    const sections = buildSectionsFromAst(tree, ['REQ-', 'AC-']);
    const filtered = filterSections(sections, {
      headings: ['Authentication'],
      tags: ['auth'],
      requirementPrefix: 'REQ-AUTH-',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Authentication');
    expect(filtered[0].requirementIds).toContain('REQ-AUTH-01');
  });

  it('filters sections by requirementPrefix alone', () => {
    const tree = parseMarkdownAst(`# Overview

General introduction.

## Authentication
REQ-AUTH-01 details.

## Billing
REQ-BILL-01 details.
`);
    const sections = buildSectionsFromAst(tree, ['REQ-', 'AC-']);
    const filtered = filterSections(sections, { requirementPrefix: 'REQ-AUTH-' });

    expect(filtered.map((section) => section.title)).toEqual(['Authentication']);
  });

  it('keeps nested subsections of a section that matches the filter', () => {
    const tree = parseMarkdownAst(`# Spec

## REQ-AUTH-01 Token verification
Verify the signature.

### Error handling
Return 401 on an invalid signature.

## REQ-BILL-01 Invoices
Issue monthly invoices.

### Rounding
Round half up.
`);
    const sections = buildSectionsFromAst(tree, ['REQ-', 'AC-']);
    const filtered = filterSections(sections, { requirementPrefix: 'REQ-AUTH-' });

    expect(filtered.map((section) => section.title)).toEqual([
      'REQ-AUTH-01 Token verification',
      'Error handling',
    ]);
  });

  it('sends only the matching requirement sections to the evaluator context', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-spec-parser-'));
    try {
      await fs.writeFile(
        path.join(dir, 'spec.md'),
        '# Spec\n\n## REQ-AUTH-01\nVerify tokens.\n\n## REQ-BILL-01\nIssue invoices.\n',
        'utf-8'
      );
      const parsed = await loadSpec('spec.md', dir, { requirementPrefix: 'REQ-AUTH-' });

      expect(parsed.filteredText).toContain('Verify tokens.');
      expect(parsed.filteredText.includes('Issue invoices.')).toBe(false);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects a specFilter that matches no section instead of sending the whole document', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-spec-parser-'));
    try {
      await fs.writeFile(
        path.join(dir, 'spec.md'),
        '# Spec\n\n## REQ-AUTH-01\nVerify tokens.\n',
        'utf-8'
      );

      await assert.rejects(
        () => loadSpec('spec.md', dir, { requirementPrefix: 'REQ-AUHT-' }),
        SpecFilterError
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('loads and filters a real spec of this repository', async () => {
    const ids = await ownRequirementIds(pkgRoot);
    const parsed = await loadSpec(path.resolve(pkgRoot, OWN_SPEC_PATH), pkgRoot, {
      requirementPrefix: OWN_REQUIREMENT_PREFIX,
    });

    expect(ids.length).toBeGreaterThan(0);
    expect(parsed.sections.length).toBeGreaterThan(0);
    expect([...new Set(parsed.requirements.map((requirement) => requirement.id))]).toEqual(ids);
    for (const id of ids) {
      expect(parsed.filteredText).toContain(id);
    }
    expect(parsed.ast.tree.type).toBe('root');
  });
});
