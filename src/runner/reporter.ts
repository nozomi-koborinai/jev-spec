import type { OverallCheckResult, TargetCheckResult, TargetPlan } from '../types.js';

const MOCK_NOTICE =
  'MOCK MODE: results come from the offline mock evaluator, not from the Jev API. ' +
  'They validate configuration, spec parsing and file matching only.';

const DRY_RUN_NOTICE =
  'DRY RUN: nothing was sent to the Jev API and no requirement was checked. ' +
  'This run validates configuration, spec parsing and file matching only.';

function countSkipped(targets: readonly TargetCheckResult[]): number {
  return targets.filter((target) => target.skipped).length;
}

function countWarnings(targets: readonly TargetCheckResult[]): number {
  return targets.reduce((total, target) => total + (target.plan?.warnings.length ?? 0), 0);
}

function listOrNone(values: readonly string[]): string {
  return values.length > 0 ? values.join(', ') : '(none)';
}

/** Terminal lines for a target of a dry run: what would be sent, never a verdict. */
function formatTerminalPlan(target: TargetCheckResult, plan: TargetPlan): string[] {
  const lines = [
    `Target: ${target.targetName} [– DRY RUN]`,
    `  Spec files: ${target.specFiles.join(', ')} (${plan.specSections.length} section(s), ${plan.specChars} chars)`,
    `  Requirement IDs: ${listOrNone(plan.requirementIds)}`,
    `  Code files: ${listOrNone(target.codeFiles)} (${plan.codeChars} chars)`,
    `  Rubrics: ${listOrNone(plan.rubrics)}`,
  ];
  for (const warning of plan.warnings) {
    lines.push(`  ⚠ ${warning}`);
  }
  lines.push(`  Est. cost of a live run: $${target.estimatedCostUsd.toFixed(5)}\n`);
  return lines;
}

export function formatTerminalReport(result: OverallCheckResult): string {
  const lines: string[] = [];
  lines.push('\n=== jev-spec Check Report ===\n');

  if (result.dryRun) {
    lines.push(`${DRY_RUN_NOTICE}\n`);
  } else if (result.mock) {
    lines.push(`${MOCK_NOTICE}\n`);
  }

  for (const target of result.targets) {
    if (target.skipped) {
      lines.push(`Target: ${target.targetName} [– SKIPPED]`);
      lines.push(`  Reason: ${target.skipReason ?? 'Not evaluated'}\n`);
      continue;
    }

    if (target.plan) {
      lines.push(...formatTerminalPlan(target, target.plan));
      continue;
    }

    const icon = target.passed ? '✔' : '✖';
    lines.push(`Target: ${target.targetName} [${icon} ${target.passed ? 'PASSED' : 'FAILED'}]`);
    lines.push(`  Spec files: ${target.specFiles.join(', ')}`);
    lines.push(`  Code files: ${target.codeFiles.join(', ')}`);

    for (const ev of target.evaluations) {
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
    lines.push(
      `  Duration: ${target.durationMs}ms | Est. cost: $${target.estimatedCostUsd.toFixed(5)}\n`
    );
  }

  const overallIcon = result.passed ? '✔' : '✖';
  const skippedCount = countSkipped(result.targets);
  const skippedNote = skippedCount > 0 ? ` [${skippedCount} target(s) skipped]` : '';
  lines.push(`----------------------------------------`);
  if (result.dryRun) {
    lines.push(
      `Overall: DRY RUN OK, the setup is valid${skippedNote} (${countWarnings(result.targets)} warning(s), ${result.totalDurationMs}ms)`
    );
    return lines.join('\n');
  }
  lines.push(
    `Overall: ${overallIcon} ${result.passed ? 'ALL CHECKS PASSED' : 'CHECKS FAILED'}${skippedNote} (${result.totalDurationMs}ms, $${result.totalEstimatedCostUsd.toFixed(5)})`
  );

  return lines.join('\n');
}

export function formatMarkdownReport(result: OverallCheckResult): string {
  const lines: string[] = [];
  lines.push('### 🛡️ `jev-spec` Check Summary\n');

  if (result.dryRun) {
    lines.push(`> ℹ️ ${DRY_RUN_NOTICE}\n`);
  } else if (result.mock) {
    lines.push(`> ⚠️ ${MOCK_NOTICE}\n`);
  }

  lines.push('| Target | Status | Passed Checks | Duration | Est. Cost |');
  lines.push('| :--- | :---: | :---: | :---: | :---: |');

  for (const target of result.targets) {
    if (target.skipped) {
      lines.push(
        `| \`${target.targetName}\` | ⏭️ SKIPPED | – | ${target.durationMs}ms | $0.00000 |`
      );
      continue;
    }

    if (target.plan) {
      lines.push(
        `| \`${target.targetName}\` | 🧪 DRY RUN | – | ${target.durationMs}ms | $${target.estimatedCostUsd.toFixed(5)} |`
      );
      continue;
    }

    const passedCount = target.evaluations.filter((e) => e.passed).length;
    const totalCount = target.evaluations.length;
    const status = target.passed ? '✅ PASS' : '❌ FAIL';
    lines.push(
      `| \`${target.targetName}\` | ${status} | ${passedCount}/${totalCount} | ${target.durationMs}ms | $${target.estimatedCostUsd.toFixed(5)} |`
    );
  }

  lines.push('\n<details><summary>Detailed Target Breakdown</summary>\n');

  for (const target of result.targets) {
    lines.push(`#### Target: \`${target.targetName}\`\n`);

    if (target.skipped) {
      lines.push(`Skipped: ${target.skipReason ?? 'Not evaluated'}\n`);
      continue;
    }

    if (target.plan) {
      lines.push(`- Spec files: ${target.specFiles.join(', ')} (${target.plan.specChars} chars)`);
      lines.push(`- Requirement IDs: ${listOrNone(target.plan.requirementIds)}`);
      lines.push(`- Code files: ${listOrNone(target.codeFiles)} (${target.plan.codeChars} chars)`);
      lines.push(`- Rubrics: ${listOrNone(target.plan.rubrics)}`);
      for (const warning of target.plan.warnings) {
        lines.push(`- ⚠️ ${warning}`);
      }
      lines.push('');
      continue;
    }

    lines.push('| Rubric | Type | Outcome | Status |');
    lines.push('| :--- | :---: | :--- | :---: |');

    for (const ev of target.evaluations) {
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
