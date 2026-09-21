import type { OverallCheckResult, ZoneCheckResult } from '../types.js';

const MOCK_NOTICE =
  'MOCK MODE: results come from the offline mock evaluator, not from the Jev API. ' +
  'They validate configuration, spec parsing and file matching only.';

function countSkipped(zones: readonly ZoneCheckResult[]): number {
  return zones.filter((zone) => zone.skipped).length;
}

export function formatTerminalReport(result: OverallCheckResult): string {
  const lines: string[] = [];
  lines.push('\n=== jev-spec Verification Report ===\n');

  if (result.mock) {
    lines.push(`${MOCK_NOTICE}\n`);
  }

  for (const zone of result.zones) {
    if (zone.skipped) {
      lines.push(`Zone: ${zone.zoneName} [– SKIPPED]`);
      lines.push(`  Reason: ${zone.skipReason ?? 'Not evaluated'}\n`);
      continue;
    }

    const icon = zone.passed ? '✔' : '✖';
    lines.push(`Zone: ${zone.zoneName} [${icon} ${zone.passed ? 'PASSED' : 'FAILED'}]`);
    lines.push(`  Spec files: ${zone.specFiles.join(', ')}`);
    lines.push(`  Code files: ${zone.codeFiles.join(', ')}`);

    for (const ev of zone.evaluations) {
      const statusIcon = ev.passed ? '✔' : '✖';
      let detail = '';
      if (ev.result.type === 'noul') {
        detail = `probability: ${ev.result.probability.toFixed(2)}`;
      } else if (ev.result.type === 'choice') {
        detail = `choice: "${ev.result.choice}" (conf: ${(ev.result.confidence * 100).toFixed(0)}%)`;
      } else if (ev.result.type === 'score') {
        detail = `score: ${ev.result.score.toFixed(1)}/${ev.result.maxScore.toFixed(1)} ("${ev.result.selectedLevel}")`;
      }

      lines.push(`    ${statusIcon} ${ev.rubricName}: ${detail}`);
      if (!ev.passed && ev.reason) {
        lines.push(`       └─ Violation: ${ev.reason}`);
      }
    }
    lines.push(`  Duration: ${zone.durationMs}ms | Est. cost: $${zone.estimatedCostUsd.toFixed(5)}\n`);
  }

  const overallIcon = result.passed ? '✔' : '✖';
  const skippedCount = countSkipped(result.zones);
  const skippedNote = skippedCount > 0 ? ` [${skippedCount} zone(s) skipped]` : '';
  lines.push(`----------------------------------------`);
  lines.push(
    `Overall: ${overallIcon} ${result.passed ? 'ALL CHECKS PASSED' : 'VERIFICATION FAILED'}${skippedNote} (${result.totalDurationMs}ms, $${result.totalEstimatedCostUsd.toFixed(5)})`
  );

  return lines.join('\n');
}

export function formatMarkdownReport(result: OverallCheckResult): string {
  const lines: string[] = [];
  lines.push('### 🛡️ `jev-spec` Verification Summary\n');

  if (result.mock) {
    lines.push(`> ⚠️ ${MOCK_NOTICE}\n`);
  }

  lines.push('| Zone | Status | Passed Checks | Duration | Est. Cost |');
  lines.push('| :--- | :---: | :---: | :---: | :---: |');

  for (const zone of result.zones) {
    if (zone.skipped) {
      lines.push(`| \`${zone.zoneName}\` | ⏭️ SKIPPED | – | ${zone.durationMs}ms | $0.00000 |`);
      continue;
    }

    const passedCount = zone.evaluations.filter((e) => e.passed).length;
    const totalCount = zone.evaluations.length;
    const status = zone.passed ? '✅ PASS' : '❌ FAIL';
    lines.push(
      `| \`${zone.zoneName}\` | ${status} | ${passedCount}/${totalCount} | ${zone.durationMs}ms | $${zone.estimatedCostUsd.toFixed(5)} |`
    );
  }

  lines.push('\n<details><summary>Detailed Zone Breakdown</summary>\n');

  for (const zone of result.zones) {
    lines.push(`#### Zone: \`${zone.zoneName}\`\n`);

    if (zone.skipped) {
      lines.push(`Skipped: ${zone.skipReason ?? 'Not evaluated'}\n`);
      continue;
    }

    lines.push('| Rubric | Type | Outcome | Status |');
    lines.push('| :--- | :---: | :--- | :---: |');

    for (const ev of zone.evaluations) {
      let outcome = '';
      if (ev.result.type === 'noul') {
        outcome = `Prob: ${ev.result.probability.toFixed(2)}`;
      } else if (ev.result.type === 'choice') {
        outcome = `\`${ev.result.choice}\` (${(ev.result.confidence * 100).toFixed(0)}%)`;
      } else if (ev.result.type === 'score') {
        outcome = `Score: ${ev.result.score.toFixed(1)}/${ev.result.maxScore.toFixed(1)} (${ev.result.selectedLevel})`;
      }
      const status = ev.passed ? '✅' : '❌';
      lines.push(`| \`${ev.rubricName}\` | \`${ev.result.type}\` | ${outcome} | ${status} |`);
    }
    lines.push('\n');
  }

  lines.push('</details>\n');
  return lines.join('\n');
}
