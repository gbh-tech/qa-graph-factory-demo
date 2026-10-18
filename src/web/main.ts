import type {
  DashboardSummary,
  TrendPoint,
  FlakyTest,
  TestRun,
  TestResult,
} from '../shared/types.ts';

// ── Types for API responses ──────────────────────────────────────────────────

interface RunWithPassRate extends TestRun {
  passRate: number;
}

interface RunDetail {
  run: TestRun;
  results: TestResult[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
}

function fmtMs(ms: number): string {
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

function badgeHtml(status: string): string {
  const map: Record<string, { cls: string; symbol: string; label: string }> = {
    passed:  { cls: 'pass',  symbol: '✓', label: 'Passed' },
    failed:  { cls: 'fail',  symbol: '✗', label: 'Failed' },
    skipped: { cls: 'skip',  symbol: '–', label: 'Skipped' },
    error:   { cls: 'error', symbol: '!', label: 'Error' },
  };
  const b = map[status] ?? { cls: 'skip', symbol: '?', label: status };
  return `<span class="badge ${b.cls}" aria-label="${b.label}">${b.symbol} ${b.label}</span>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── renderKpis ───────────────────────────────────────────────────────────────

export function renderKpis(summary: DashboardSummary): void {
  const grid = document.getElementById('kpi-grid');
  if (!grid) return;

  const passClass = summary.passRate >= 0.95 ? 'pass' : summary.passRate < 0.8 ? 'risk' : '';
  const defectClass = summary.openDefects > 5 ? 'risk' : '';

  grid.innerHTML = `
    <article class="kpi-card" aria-label="Pass rate ${fmtPct(summary.passRate)}">
      <div class="kpi-number ${passClass}" aria-hidden="true">${fmtPct(summary.passRate)}</div>
      <div class="kpi-label">Pass rate (30 days)</div>
    </article>
    <article class="kpi-card" aria-label="Total runs ${summary.totalRuns}">
      <div class="kpi-number" aria-hidden="true">${summary.totalRuns.toLocaleString()}</div>
      <div class="kpi-label">Total runs</div>
    </article>
    <article class="kpi-card" aria-label="Flaky tests ${summary.flakyCount}">
      <div class="kpi-number risk" aria-hidden="true">${summary.flakyCount}</div>
      <div class="kpi-label">Flaky tests</div>
    </article>
    <article class="kpi-card" aria-label="Open defects ${summary.openDefects}">
      <div class="kpi-number ${defectClass}" aria-hidden="true">${summary.openDefects}</div>
      <div class="kpi-label">Open defects</div>
    </article>
  `;
}

// ── renderTrendChart ─────────────────────────────────────────────────────────

export function renderTrendChart(trend: TrendPoint[]): void {
  const container = document.getElementById('trend-chart');
  if (!container) return;
  if (trend.length === 0) {
    container.innerHTML = '<p class="loading">No trend data available.</p>';
    return;
  }

  const W = 900;
  const H = 220;
  const PAD = { top: 20, right: 20, bottom: 36, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const n = trend.length;

  // Zoomed y-domain: floor the minimum to the nearest 5% below (min − 5%), clamped ≥ 0
  const minRate = Math.min(...trend.map(p => p.passRate));
  const domainMin = Math.max(0, Math.floor((minRate - 0.05) * 20) / 20);
  const domainMax = 1.0;
  const domainSpan = domainMax - domainMin;

  const xScale = (i: number) => PAD.left + (i / (n - 1)) * chartW;
  const yScale = (v: number) => PAD.top + chartH - ((v - domainMin) / domainSpan) * chartH;

  // Build polyline points
  const pts = trend.map((p, i) => `${xScale(i)},${yScale(p.passRate)}`).join(' ');

  // Area path (filled under the line) — baseline at domainMin
  const areaPath =
    `M ${xScale(0)},${yScale(trend[0].passRate)} ` +
    trend.slice(1).map((p, i) => `L ${xScale(i + 1)},${yScale(p.passRate)}`).join(' ') +
    ` L ${xScale(n - 1)},${PAD.top + chartH} L ${xScale(0)},${PAD.top + chartH} Z`;

  // X axis labels — show ~6 evenly spaced dates
  const xLabels: string[] = [];
  const labelCount = Math.min(6, n);
  for (let li = 0; li < labelCount; li++) {
    const idx = Math.round((li / (labelCount - 1)) * (n - 1));
    const x = xScale(idx);
    const label = trend[idx].date.slice(5); // MM-DD
    xLabels.push(
      `<text x="${x}" y="${PAD.top + chartH + 20}" text-anchor="middle" font-size="11" fill="#636466">${escape(label)}</text>`
    );
  }

  // Y axis labels — 5% ticks from domainMin to 100%
  const yLabels: string[] = [];
  const gridLines: string[] = [];
  // Build ticks at every 5% step from domainMin to domainMax
  const tickStep = 0.05;
  for (let v = domainMin; v <= domainMax + 0.001; v = Math.round((v + tickStep) * 1000) / 1000) {
    const y = yScale(v);
    yLabels.push(
      `<text x="${PAD.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#636466">${Math.round(v * 100)}%</text>`
    );
    gridLines.push(
      `<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + chartW}" y2="${y}" stroke="#D5D7D8" stroke-width="1" stroke-dasharray="3,3"/>`
    );
  }

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" aria-labelledby="trend-title trend-desc" role="img">
      <title id="trend-title">30-day pass-rate trend</title>
      <desc id="trend-desc">Line chart showing daily test pass rate over the last 30 days, y-axis from ${Math.round(domainMin * 100)}% to 100%, ranging from ${fmtPct(Math.min(...trend.map(p => p.passRate)))} to ${fmtPct(Math.max(...trend.map(p => p.passRate)))}</desc>

      <!-- Grid lines -->
      ${gridLines.join('\n')}

      <!-- Area fill -->
      <defs>
        <linearGradient id="trend-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#00AE41" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#04A6E1" stop-opacity="0.18"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#trend-gradient)"/>

      <!-- Line -->
      <polyline
        points="${pts}"
        fill="none"
        stroke="#062F6E"
        stroke-width="2.5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- Dots at each data point -->
      ${trend.map((p, i) => `<circle cx="${xScale(i)}" cy="${yScale(p.passRate)}" r="3" fill="#062F6E" aria-label="${p.date}: ${fmtPct(p.passRate)}" role="img"/>`).join('\n')}

      <!-- Axes -->
      <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + chartH}" stroke="#D5D7D8" stroke-width="1"/>
      <line x1="${PAD.left}" y1="${PAD.top + chartH}" x2="${PAD.left + chartW}" y2="${PAD.top + chartH}" stroke="#D5D7D8" stroke-width="1"/>

      <!-- Labels -->
      ${yLabels.join('\n')}
      ${xLabels.join('\n')}
    </svg>
  `;
}

// ── renderFlakyTable ─────────────────────────────────────────────────────────

export function renderFlakyTable(flaky: FlakyTest[]): void {
  const container = document.getElementById('flaky-table');
  if (!container) return;
  if (flaky.length === 0) {
    container.innerHTML = '<p class="loading" style="padding:24px;">No flaky tests detected.</p>';
    return;
  }

  const rows = flaky
    .map(
      (f) => `
    <tr>
      <td>${escape(f.name)}</td>
      <td class="num">${f.flips}</td>
      <td class="num">
        <span aria-label="${fmtPct(f.failRate)} fail rate">
          <span class="rate-bar-bg" aria-hidden="true">
            <span class="rate-bar-fill" style="width:${Math.min(100, f.failRate * 100).toFixed(1)}%"></span>
          </span>
          &nbsp;${fmtPct(f.failRate)}
        </span>
      </td>
    </tr>
  `
    )
    .join('');

  container.innerHTML = `
    <table>
      <caption>Tests that alternated between pass and fail in the last 30 days</caption>
      <thead>
        <tr>
          <th scope="col">Test name</th>
          <th scope="col" class="num">Flips</th>
          <th scope="col" class="num">Fail rate</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ── renderRunsTable ──────────────────────────────────────────────────────────

export function renderRunsTable(runs: RunWithPassRate[]): void {
  const container = document.getElementById('runs-table');
  if (!container) return;
  if (runs.length === 0) {
    container.innerHTML = '<p class="loading" style="padding:24px;">No runs found.</p>';
    return;
  }

  const rows = runs
    .map(
      (r) => `
    <tr>
      <td>
        <button class="run-link" data-run-id="${escape(r.id)}" aria-label="View detail for run ${escape(r.id)}">
          ${escape(r.id)}
        </button>
      </td>
      <td>${escape(r.suite)}</td>
      <td>${escape(r.branch)}</td>
      <td>${escape(fmtDate(r.startedAt))}</td>
      <td class="num">${fmtMs(r.durationMs)}</td>
      <td class="num">${fmtPct(r.passRate)}</td>
    </tr>
  `
    )
    .join('');

  container.innerHTML = `
    <table>
      <caption>Most recent test runs — click a run ID to see results</caption>
      <thead>
        <tr>
          <th scope="col">Run ID</th>
          <th scope="col">Suite</th>
          <th scope="col">Branch</th>
          <th scope="col">Started</th>
          <th scope="col" class="num">Duration</th>
          <th scope="col" class="num">Pass rate</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  // Attach click handlers
  container.querySelectorAll<HTMLButtonElement>('.run-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      const runId = btn.dataset.runId;
      if (runId) renderRunDetail(runId);
    });
  });
}

// ── renderRunDetail ──────────────────────────────────────────────────────────

export async function renderRunDetail(runId: string): Promise<void> {
  const panel = document.getElementById('run-detail');
  const content = document.getElementById('detail-content');
  const title = document.getElementById('detail-heading');
  if (!panel || !content || !title) return;

  panel.classList.add('visible');
  content.innerHTML = '<p class="loading">Loading…</p>';
  if (title) title.textContent = `Run: ${runId}`;

  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const resp = await fetch(`/api/runs/${encodeURIComponent(runId)}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data: RunDetail = (await resp.json()) as RunDetail;

    const { run, results } = data;

    const meta = `
      <dl style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:16px;font-size:14px;">
        <div><dt style="color:var(--gbh-muted);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;">Suite</dt><dd>${escape(run.suite)}</dd></div>
        <div><dt style="color:var(--gbh-muted);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;">Branch</dt><dd>${escape(run.branch)}</dd></div>
        <div><dt style="color:var(--gbh-muted);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;">Commit</dt><dd><code>${escape(run.commit)}</code></dd></div>
        <div><dt style="color:var(--gbh-muted);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;">Started</dt><dd>${escape(run.startedAt)}</dd></div>
        <div><dt style="color:var(--gbh-muted);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;">Duration</dt><dd>${fmtMs(run.durationMs)}</dd></div>
      </dl>
    `;

    const items = results
      .map(
        (r) => `
      <li class="result-item">
        ${badgeHtml(r.status)}
        <span class="result-name">${escape(r.name)}</span>
        <span class="result-dur">${fmtMs(r.durationMs)}</span>
      </li>
    `
      )
      .join('');

    content.innerHTML = `
      ${meta}
      <h3 style="font-size:14px;font-weight:600;color:var(--gbh-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">
        Results (${results.length})
      </h3>
      <ul class="results-list" aria-label="Test results for run ${escape(runId)}">
        ${items}
      </ul>
    `;
  } catch (err) {
    content.innerHTML = `<p style="color:#C0392B;">Failed to load run detail: ${escape(String(err))}</p>`;
  }
}

// ── uploadReport ─────────────────────────────────────────────────────────────

export async function uploadReport(form: HTMLFormElement): Promise<void> {
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const formatSelect = document.getElementById('format-select') as HTMLSelectElement;
  const btn = document.getElementById('upload-btn') as HTMLButtonElement;
  const msgEl = document.getElementById('upload-msg') as HTMLElement;

  const file = fileInput.files?.[0];
  if (!file) {
    msgEl.className = 'upload-msg error';
    msgEl.textContent = 'Please select a file.';
    return;
  }

  const format = formatSelect.value;

  btn.disabled = true;
  msgEl.className = 'upload-msg';
  msgEl.textContent = '';

  try {
    const text = await file.text();
    const resp = await fetch(`/api/runs?format=${encodeURIComponent(format)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: text,
    });

    const body = (await resp.json()) as { runId?: string; error?: string; message?: string };

    if (resp.ok) {
      msgEl.className = 'upload-msg success';
      msgEl.textContent = `Report uploaded successfully. Run ID: ${body.runId ?? '—'}`;
      form.reset();
      // Refresh dashboard data
      await loadDashboard();
    } else {
      const errName = body.error ?? 'Error';
      const errMsg = body.message ?? 'Unknown error';
      msgEl.className = 'upload-msg error';
      msgEl.textContent = `${errName}: ${errMsg}`;
    }
  } catch (err) {
    msgEl.className = 'upload-msg error';
    msgEl.textContent = `Network error: ${String(err)}`;
  } finally {
    btn.disabled = false;
  }
}

// ── loadDashboard ─────────────────────────────────────────────────────────────

export async function loadDashboard(): Promise<void> {
  try {
    const [summaryResp, runsResp] = await Promise.all([
      fetch('/api/dashboard'),
      fetch('/api/runs?limit=20'),
    ]);

    if (!summaryResp.ok) throw new Error(`Dashboard API error ${summaryResp.status}`);
    if (!runsResp.ok) throw new Error(`Runs API error ${runsResp.status}`);

    const summary: DashboardSummary = (await summaryResp.json()) as DashboardSummary;
    const runs: RunWithPassRate[] = (await runsResp.json()) as RunWithPassRate[];

    // Update hero status
    const heroEl = document.getElementById('hero-status');
    if (heroEl) {
      const now = new Date().toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      heroEl.textContent = `Last 30 days · updated ${now}`;
    }

    renderKpis(summary);
    renderTrendChart(summary.trend);
    renderFlakyTable(summary.flaky);
    renderRunsTable(runs);
  } catch (err) {
    console.error('Failed to load dashboard:', err);
    const heroEl = document.getElementById('hero-status');
    if (heroEl) heroEl.textContent = 'Failed to load data — is the API running?';
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

// Close detail panel
document.getElementById('close-detail')?.addEventListener('click', () => {
  const panel = document.getElementById('run-detail');
  panel?.classList.remove('visible');
});

// Upload form
document.getElementById('upload-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget as HTMLFormElement;
  void uploadReport(form);
});

// Initial load
void loadDashboard();
