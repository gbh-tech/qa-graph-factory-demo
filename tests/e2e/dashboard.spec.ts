import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(__dirname, '../../seed/fixtures/sample-run.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function waitForDashboard(page: Page) {
  // Wait until both KPIs and the flaky/runs sections are rendered (not loading state)
  await page.waitForFunction(() => {
    const grid = document.getElementById('kpi-grid');
    const flaky = document.getElementById('flaky-table');
    const runs = document.getElementById('runs-table');
    const gridOk = grid !== null && !grid.textContent?.includes('Loading');
    const flakyOk = flaky !== null && !flaky.textContent?.includes('Loading');
    const runsOk = runs !== null && !runs.textContent?.includes('Loading');
    return gridOk && flakyOk && runsOk;
  }, { timeout: 15_000 });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForDashboard(page);
});

test('KPIs render with numbers', async ({ page }) => {
  const grid = page.locator('#kpi-grid');
  await expect(grid).toBeVisible();

  // All 4 KPI cards present
  const cards = grid.locator('.kpi-card');
  await expect(cards).toHaveCount(4);

  // Each card has a non-empty kpi-number
  for (let i = 0; i < 4; i++) {
    const num = cards.nth(i).locator('.kpi-number');
    const text = await num.innerText();
    expect(text.trim().length).toBeGreaterThan(0);
    // Numbers should be numeric/percentage — not "Loading"
    expect(text).not.toContain('Loading');
  }

  // Pass rate card specifically
  const passCard = cards.first();
  const passText = await passCard.locator('.kpi-number').innerText();
  expect(passText).toMatch(/\d+\.\d+%/);
});

test('Trend chart has 30 data points', async ({ page }) => {
  const chartContainer = page.locator('#trend-chart');
  await expect(chartContainer).toBeVisible();

  // The SVG should exist
  const svg = chartContainer.locator('svg');
  await expect(svg).toBeVisible();

  // Should have exactly 30 circle elements (one per day)
  const circles = svg.locator('circle');
  await expect(circles).toHaveCount(30);
});

test('Flaky table lists at least one test', async ({ page }) => {
  const tableContainer = page.locator('#flaky-table');
  await expect(tableContainer).toBeVisible();

  // Table element should be present
  const table = tableContainer.locator('table');
  await expect(table).toBeVisible();

  // At least one data row
  const rows = tableContainer.locator('tbody tr');
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // First row has a test name
  const firstRowText = await rows.first().innerText();
  expect(firstRowText.trim().length).toBeGreaterThan(0);
});

test('Upload sample-run.json → success message and new run appears', async ({ page }) => {
  // Upload the fixture
  const fileInput = page.locator('#file-input');
  await fileInput.setInputFiles(FIXTURE_PATH);

  const formatSelect = page.locator('#format-select');
  await formatSelect.selectOption('json');

  const uploadBtn = page.locator('#upload-btn');
  await uploadBtn.click();

  // Wait for success message
  const msg = page.locator('#upload-msg');
  await expect(msg).toHaveClass(/success/, { timeout: 10_000 });
  await expect(msg).toContainText('uploaded successfully');

  // The runs table should refresh — look for the new run ID
  const runsTable = page.locator('#runs-table');
  await expect(runsTable.locator('table')).toBeVisible({ timeout: 10_000 });
  await expect(runsTable.locator('tbody')).toContainText('sample-json-run-001', { timeout: 10_000 });
});

test('Uploading same file again shows DuplicateRunError', async ({ page }) => {
  // The previous Upload test already inserted sample-json-run-001.
  // Uploading the same fixture again must return DuplicateRunError.
  const fileInput = page.locator('#file-input');
  await fileInput.setInputFiles(FIXTURE_PATH);
  await page.locator('#format-select').selectOption('json');
  await page.locator('#upload-btn').click();

  const msg = page.locator('#upload-msg');
  // Wait for the message to appear (success if first insert, error if already exists)
  await expect(msg).toHaveClass(/success|error/, { timeout: 10_000 });

  if ((await msg.getAttribute('class'))?.includes('success')) {
    // First upload succeeded — upload again to get the duplicate
    await fileInput.setInputFiles(FIXTURE_PATH);
    await page.locator('#format-select').selectOption('json');
    await page.locator('#upload-btn').click();
    await expect(msg).toHaveClass(/error/, { timeout: 10_000 });
  }

  // Either way, the current state should be DuplicateRunError
  await expect(msg).toHaveClass(/error/, { timeout: 10_000 });
  await expect(msg).toContainText('DuplicateRunError');
});

test('Clicking a run shows its detail panel', async ({ page }) => {
  // Wait for runs table to be rendered with links
  const runsTable = page.locator('#runs-table');
  await expect(runsTable.locator('table')).toBeVisible();

  // Click the first run link
  const firstRunLink = runsTable.locator('.run-link').first();
  const runId = await firstRunLink.getAttribute('data-run-id');
  expect(runId).toBeTruthy();

  await firstRunLink.click();

  // Detail panel should become visible
  const detail = page.locator('#run-detail');
  await expect(detail).toBeVisible({ timeout: 10_000 });

  // Detail should contain results
  const resultsList = detail.locator('.results-list');
  await expect(resultsList).toBeVisible({ timeout: 10_000 });

  // At least one result item
  const items = resultsList.locator('.result-item');
  const count = await items.count();
  expect(count).toBeGreaterThan(0);

  // Should have a badge
  await expect(items.first().locator('.badge')).toBeVisible();
});

// ── Screenshot tests ──────────────────────────────────────────────────────────

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '820', width: 820, height: 1180 },
  { name: '1440', width: 1440, height: 900 },
];

for (const vp of VIEWPORTS) {
  test(`screenshot at ${vp.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    await waitForDashboard(page);

    // Let charts render fully
    await page.waitForTimeout(500);

    const screenshotPath = path.resolve(
      __dirname,
      `../../docs/screenshots/dashboard-${vp.name}.png`
    );

    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });

    // Verify no horizontal scroll at page level
    const hasHScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHScroll).toBe(false);
  });
}
