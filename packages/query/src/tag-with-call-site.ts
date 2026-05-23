/**
 * Parse the V8 Error stack to extract the caller's file path and line number
 * at the given stack depth relative to the top of the Error frame.
 *
 * Stack frame layout (0-based from line 1 of err.stack):
 *   0 — captureCallSiteTag itself
 *   1 — Queryable.tagWithCallSite
 *   2 — the user's actual call site  ← desired
 *
 * @param stackDepth - How many frames to skip above this function (default 2).
 * @returns Formatted string `"File: <path>:<line>"` or `"File: unknown"`.
 */
export function captureCallSiteTag(stackDepth: number = 2): string {
  const err = new Error();
  const stack = err.stack ?? '';
  // err.stack starts with "Error\n" then "    at ..." lines
  const lines = stack.split('\n');
  // lines[0] is "Error", lines[1..] are at-frames
  const callerLine = lines[stackDepth + 1] ?? '';

  // Patterns:
  //   "    at Object.<anon> (/abs/path/file.ts:42:5)"  — with parens
  //   "    at /abs/path/file.ts:42:5"                   — without parens
  const withParens = /\((.+):(\d+):\d+\)/.exec(callerLine);
  if (withParens) {
    return `File: ${withParens[1]}:${withParens[2]}`;
  }

  const withoutParens = /at (.+):(\d+):\d+/.exec(callerLine);
  if (withoutParens) {
    return `File: ${withoutParens[1]}:${withoutParens[2]}`;
  }

  return 'File: unknown';
}
