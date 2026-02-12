// In-house line-by-line diff using LCS (Longest Common Subsequence)
// No external dependencies. Produces human-readable unified-style diffs.

/**
 * Compute LCS table for two arrays of lines
 */
function lcsTable(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Backtrack LCS table to produce diff operations
 * Returns array of { type: 'equal'|'add'|'remove', line, lineNum }
 */
function backtrack(dp, a, b) {
  const result = [];
  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'equal', line: a[i - 1], oldLine: i, newLine: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', line: b[j - 1], newLine: j });
      j--;
    } else {
      result.unshift({ type: 'remove', line: a[i - 1], oldLine: i });
      i--;
    }
  }

  return result;
}

/**
 * Compute diff between two strings (old and new content).
 * Returns an object with:
 *   - hunks: array of change groups (context lines + changes)
 *   - stats: { added, removed }
 */
export function diffLines(oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const dp = lcsTable(oldLines, newLines);
  const ops = backtrack(dp, oldLines, newLines);

  // Group ops into hunks (consecutive changes with context)
  const contextLines = 3;
  const hunks = [];
  let currentHunk = null;
  let stats = { added: 0, removed: 0 };

  for (let idx = 0; idx < ops.length; idx++) {
    const op = ops[idx];

    if (op.type !== 'equal') {
      if (op.type === 'add') stats.added++;
      if (op.type === 'remove') stats.removed++;

      if (!currentHunk) {
        // Start new hunk with preceding context
        currentHunk = { lines: [] };
        const contextStart = Math.max(0, idx - contextLines);
        for (let c = contextStart; c < idx; c++) {
          currentHunk.lines.push(ops[c]);
        }
      }
      currentHunk.lines.push(op);
    } else if (currentHunk) {
      // Check if next change is within context distance
      const nextChangeIdx = ops.findIndex((o, i) => i > idx && o.type !== 'equal');
      if (nextChangeIdx !== -1 && nextChangeIdx - idx <= contextLines * 2) {
        currentHunk.lines.push(op);
      } else {
        // Add trailing context and close hunk
        const trailingEnd = Math.min(ops.length, idx + contextLines);
        for (let c = idx; c < trailingEnd; c++) {
          currentHunk.lines.push(ops[c]);
        }
        hunks.push(currentHunk);
        currentHunk = null;
        // Skip context lines we already added
        idx = trailingEnd - 1;
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return { hunks, stats };
}

/**
 * Format a diff result as a unified-style string (for display)
 */
export function formatDiff(diffResult) {
  const { hunks } = diffResult;
  if (hunks.length === 0) return '';

  const lines = [];
  for (const hunk of hunks) {
    for (const op of hunk.lines) {
      if (op.type === 'equal') {
        lines.push(`  ${op.line}`);
      } else if (op.type === 'add') {
        lines.push(`+ ${op.line}`);
      } else if (op.type === 'remove') {
        lines.push(`- ${op.line}`);
      }
    }
    lines.push('---');
  }

  return lines.join('\n');
}
