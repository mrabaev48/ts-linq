import type { Stats } from 'fs';

interface ScenarioResultSummary {
  readonly n: number;
  readonly avg: number;
  readonly p50: number;
  readonly p90: number;
  readonly p95: number;
  readonly p99: number;
  readonly min: number;
  readonly max: number;
  readonly totalMs: number;
  readonly opsPerSec: number;
}

interface ProviderRunResult {
  readonly provider: 'sqlite' | 'postgresql' | 'mysql' | string;
  readonly scenarios: Record<string, ScenarioResultSummary>;
  readonly rows: number;
  readonly iterations: number;
}

interface SuiteResult {
  readonly timestamp: number;
  readonly results: ProviderRunResult[];
  readonly config: {
    readonly providers: ReadonlyArray<string>;
    readonly rows: number;
    readonly iterations: number;
    readonly format: 'json' | 'csv' | string;
  };
}

interface ScenarioDiff {
  readonly provider: string;
  readonly scenario: string;
  readonly base: ScenarioResultSummary | null;
  readonly current: ScenarioResultSummary | null;
  readonly avgChangePct: number | null;
  readonly p95ChangePct: number | null;
  readonly opsChangePct: number | null;
}

function isJsonPathOrHasSlash(s: string): boolean {
  return s.endsWith('.json') || s.includes('/') || s.includes('\\');
}

function resolveTagOrPath(input: string): string {
  if (isJsonPathOrHasSlash(input)) return input;
  return `bench-results/${input}.json`;
}

function readSuite(path: string): SuiteResult {
  const fs = require('fs') as typeof import('fs');
  const data = fs.readFileSync(path, 'utf-8');
  const parsed = JSON.parse(data) as SuiteResult;
  if (!parsed || !Array.isArray(parsed.results)) {
    throw new Error(`Invalid suite file: ${path}`);
  }
  return parsed;
}

function pct(from: number, to: number): number | null {
  if (!isFinite(from) || from === 0) return null;
  return ((from - to) / from) * 100;
}

function buildDiff(base: SuiteResult, current: SuiteResult): ScenarioDiff[] {
  const diffs: ScenarioDiff[] = [];
  const byProvBase = new Map<string, ProviderRunResult>();
  const byProvCurr = new Map<string, ProviderRunResult>();
  for (const r of base.results) byProvBase.set(r.provider, r);
  for (const r of current.results) byProvCurr.set(r.provider, r);
  const providers = new Set<string>([
    ...Array.from(byProvBase.keys()),
    ...Array.from(byProvCurr.keys())
  ]);
  for (const p of providers) {
    const b = byProvBase.get(p) || null;
    const c = byProvCurr.get(p) || null;
    const scenarios = new Set<string>([
      ...Object.keys(b?.scenarios || {}),
      ...Object.keys(c?.scenarios || {})
    ]);
    for (const s of scenarios) {
      const bsum = (b?.scenarios || {})[s] || null;
      const csum = (c?.scenarios || {})[s] || null;
      const avgChangePct = bsum && csum ? pct(bsum.avg, csum.avg) : null;
      const p95ChangePct = bsum && csum ? pct(bsum.p95, csum.p95) : null;
      const opsChangePct = bsum && csum ? pct(bsum.opsPerSec, csum.opsPerSec) : null;
      diffs.push({
        provider: p,
        scenario: s,
        base: bsum,
        current: csum,
        avgChangePct,
        p95ChangePct,
        opsChangePct
      });
    }
  }
  return diffs.sort((a, b) => (a.provider + a.scenario).localeCompare(b.provider + b.scenario));
}

function toMarkdown(diffs: readonly ScenarioDiff[], tolerancePct: number): string {
  const header =
    '| provider | scenario | avg_base | avg_curr | avg Δ% | p95_base | p95_curr | p95 Δ% | ops_base | ops_curr | ops Δ% | verdict |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|';
  const lines: string[] = [header];
  for (const d of diffs) {
    const avgBase = d.base?.avg ?? NaN;
    const avgCurr = d.current?.avg ?? NaN;
    const p95Base = d.base?.p95 ?? NaN;
    const p95Curr = d.current?.p95 ?? NaN;
    const opsBase = d.base?.opsPerSec ?? NaN;
    const opsCurr = d.current?.opsPerSec ?? NaN;
    const avgCh = d.avgChangePct;
    const p95Ch = d.p95ChangePct;
    const opsCh = d.opsChangePct;
    const verdict = (() => {
      const v = avgCh ?? 0;
      if (Math.abs(v) < tolerancePct) return 'same';
      return v > 0 ? 'improved' : 'regressed';
    })();
    lines.push(
      `| ${d.provider} | ${d.scenario} | ${isFinite(avgBase) ? avgBase.toFixed(2) : '-'} | ${
        isFinite(avgCurr) ? avgCurr.toFixed(2) : '-'
      } | ${avgCh === null ? '-' : avgCh.toFixed(2)} | ${
        isFinite(p95Base) ? p95Base.toFixed(2) : '-'
      } | ${isFinite(p95Curr) ? p95Curr.toFixed(2) : '-'} | ${
        p95Ch === null ? '-' : p95Ch.toFixed(2)
      } | ${isFinite(opsBase) ? opsBase.toFixed(2) : '-'} | ${
        isFinite(opsCurr) ? opsCurr.toFixed(2) : '-'
      } | ${opsCh === null ? '-' : opsCh.toFixed(2)} | ${verdict} |`
    );
  }
  return lines.join('\n');
}

function toCsv(diffs: readonly ScenarioDiff[]): string {
  const header =
    'provider,scenario,avg_base,avg_curr,avg_change_pct,p95_base,p95_curr,p95_change_pct,ops_base,ops_curr,ops_change_pct';
  const lines: string[] = [header];
  for (const d of diffs) {
    const avgBase = d.base?.avg ?? NaN;
    const avgCurr = d.current?.avg ?? NaN;
    const p95Base = d.base?.p95 ?? NaN;
    const p95Curr = d.current?.p95 ?? NaN;
    const opsBase = d.base?.opsPerSec ?? NaN;
    const opsCurr = d.current?.opsPerSec ?? NaN;
    lines.push(
      `${d.provider},${d.scenario},${isFinite(avgBase) ? avgBase.toFixed(2) : ''},${
        isFinite(avgCurr) ? avgCurr.toFixed(2) : ''
      },${d.avgChangePct === null ? '' : d.avgChangePct.toFixed(2)},${
        isFinite(p95Base) ? p95Base.toFixed(2) : ''
      },${isFinite(p95Curr) ? p95Curr.toFixed(2) : ''},${
        d.p95ChangePct === null ? '' : d.p95ChangePct.toFixed(2)
      },${isFinite(opsBase) ? opsBase.toFixed(2) : ''},${
        isFinite(opsCurr) ? opsCurr.toFixed(2) : ''
      },${d.opsChangePct === null ? '' : d.opsChangePct.toFixed(2)}`
    );
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let baseArg: string | undefined;
  let currArg: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--base' && i + 1 < args.length) baseArg = args[++i];
    else if (a === '--current' && i + 1 < args.length) currArg = args[++i];
    else if (!baseArg) baseArg = a;
    else if (!currArg) currArg = a;
  }
  const basePath = resolveTagOrPath(baseArg || process.env.BENCH_BASE || 'baseline');
  const currPath = resolveTagOrPath(currArg || process.env.BENCH_CURRENT || 'current');

  const base = readSuite(basePath);
  const curr = readSuite(currPath);
  const diffs = buildDiff(base, curr);

  const formatEnv = (process.env.BENCH_COMPARE_FORMAT || 'markdown').toLowerCase();
  const tolerance = parseFloat(process.env.BENCH_COMPARE_TOLERANCE || '2');
  if (formatEnv === 'json') {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ base: basePath, current: currPath, diffs }, null, 2));
  } else if (formatEnv === 'csv') {
    // eslint-disable-next-line no-console
    console.log(toCsv(diffs));
  } else {
    // eslint-disable-next-line no-console
    console.log(toMarkdown(diffs, isFinite(tolerance) ? tolerance : 2));
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
