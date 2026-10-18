import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { openDb } from '../src/server/db/connection.ts';
import { applySchema } from '../src/server/db/schema.ts';
import { insertRun } from '../src/server/db/repos/runsRepo.ts';
import { insertResults } from '../src/server/db/repos/resultsRepo.ts';
import { insertDefect } from '../src/server/db/repos/defectsRepo.ts';
import type { TestRun, TestResult, Defect, Status } from '../src/shared/types.ts';

// --- Deterministic PRNG (mulberry32, seed 42) ---
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);

function randInt(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

// --- Test catalogue ---
const SUITES: Record<string, string[][]> = {
  api: [
    ['auth.spec', 'login successfully'],
    ['auth.spec', 'logout clears session'],
    ['auth.spec', 'refresh token'],
    ['auth.spec', 'rejects invalid credentials'],
    ['auth.spec', 'token expiry returns 401'],
    ['users.spec', 'creates a new user'],
    ['users.spec', 'returns user by id'],
    ['users.spec', 'updates user profile'],
    ['users.spec', 'deletes user account'],
    ['users.spec', 'lists users with pagination'],
    ['products.spec', 'lists products'],
    ['products.spec', 'gets product by id'],
    ['products.spec', 'creates product'],
    ['products.spec', 'filters by category'],
    ['products.spec', 'full-text search'],
    ['orders.spec', 'creates order'],
    ['orders.spec', 'gets order details'],
    ['orders.spec', 'cancels order'],
    ['orders.spec', 'updates order status'],
    ['orders.spec', 'lists orders by user'],
    ['health.spec', 'liveness probe'],
    ['health.spec', 'readiness probe'],
    ['middleware.spec', 'rate limiting blocks excess requests'],
    ['middleware.spec', 'cors headers present'],
    ['middleware.spec', 'auth middleware rejects missing token'],
    ['middleware.spec', 'request validation rejects bad schema'],
    ['middleware.spec', 'error format is consistent'],
    ['events.spec', 'publishes event to queue'],
    ['events.spec', 'consumes event from queue'],
    ['events.spec', 'dead letter queue'],
  ],
  web: [
    ['login.spec', 'renders login form'],
    ['login.spec', 'validates email format'],
    ['login.spec', 'validates password length'],
    ['login.spec', 'successful login redirects to dashboard'],
    ['login.spec', 'failed login shows error'],
    ['search.spec', 'basic keyword search'],
    ['search.spec', 'filter by price range'],
    ['search.spec', 'pagination works'],
    ['search.spec', 'no results state'],
    ['search.spec', 'sort by relevance'],
    ['checkout.spec', 'rejects expired card'],
    ['checkout.spec', 'applies discount coupon'],
    ['checkout.spec', 'calculates shipping cost'],
    ['checkout.spec', 'redirects on empty cart'],
    ['checkout.spec', 'submits order successfully'],
    ['cart.spec', 'adds item to cart'],
    ['cart.spec', 'removes item from cart'],
    ['cart.spec', 'updates item quantity'],
    ['cart.spec', 'persists cart across sessions'],
    ['cart.spec', 'calculates total price'],
    ['profile.spec', 'displays user profile'],
    ['profile.spec', 'edits display name'],
    ['profile.spec', 'changes password'],
    ['profile.spec', 'uploads avatar'],
    ['profile.spec', 'deletes account'],
    ['navigation.spec', 'header links are correct'],
    ['navigation.spec', 'footer links are correct'],
    ['navigation.spec', 'breadcrumbs update on navigation'],
    ['navigation.spec', '404 page renders'],
    ['navigation.spec', 'back button works'],
  ],
  mobile: [
    ['onboarding.spec', 'welcome screen renders'],
    ['onboarding.spec', 'create account flow'],
    ['onboarding.spec', 'verify email step'],
    ['onboarding.spec', 'skip tutorial button'],
    ['onboarding.spec', 'complete profile setup'],
    ['push.spec', 'requests push permission'],
    ['push.spec', 'receives foreground notification'],
    ['push.spec', 'tap notification opens deep link'],
    ['push.spec', 'background fetch completes'],
    ['push.spec', 'badge count updates'],
    ['notifications.spec', 'in-app alert displays'],
    ['notifications.spec', 'clear all notifications'],
    ['notifications.spec', 'marks notification as read'],
    ['notifications.spec', 'filter by notification type'],
    ['notifications.spec', 'notification settings toggle'],
    ['sync.spec', 'initial full sync'],
    ['sync.spec', 'incremental sync on reconnect'],
    ['sync.spec', 'conflict resolution prefers server'],
    ['sync.spec', 'offline mode queues writes'],
    ['sync.spec', 'reconnects after network loss'],
    ['payment.spec', 'adds credit card'],
    ['payment.spec', 'removes saved card'],
    ['payment.spec', 'sets default payment method'],
    ['payment.spec', 'apple pay flow'],
    ['payment.spec', 'payment history list'],
    ['settings.spec', 'dark mode toggle'],
    ['settings.spec', 'language selection'],
    ['settings.spec', 'notifications settings toggle'],
    ['settings.spec', 'privacy settings'],
    ['settings.spec', 'logout clears local data'],
  ],
  payments: [
    ['checkout.spec', 'rejects expired card'],
    ['checkout.spec', 'processes valid card'],
    ['checkout.spec', '3DS authentication flow'],
    ['checkout.spec', 'declined transaction error'],
    ['checkout.spec', 'amount validation rejects zero'],
    ['refunds.spec', 'full refund issued'],
    ['refunds.spec', 'partial refund issued'],
    ['refunds.spec', 'refund status polling'],
    ['refunds.spec', 'cancel pending refund'],
    ['refunds.spec', 'refund timeline displayed'],
    ['webhooks.spec', 'payment success event delivered'],
    ['webhooks.spec', 'payment failed event delivered'],
    ['webhooks.spec', 'refund event delivered'],
    ['webhooks.spec', 'signature validation rejects tampered payload'],
    ['webhooks.spec', 'replay attack prevention'],
    ['fraud.spec', 'velocity check blocks rapid attempts'],
    ['fraud.spec', 'card fingerprinting identifies duplicates'],
    ['fraud.spec', 'ip reputation check'],
    ['fraud.spec', 'device fingerprinting'],
    ['fraud.spec', 'risk score threshold blocks high-risk'],
    ['currency.spec', 'USD payment processes'],
    ['currency.spec', 'EUR payment processes'],
    ['currency.spec', 'GBP payment processes'],
    ['currency.spec', 'exchange rate applied correctly'],
    ['currency.spec', 'multi-currency report'],
    ['reconciliation.spec', 'daily settlement batch'],
    ['reconciliation.spec', 'batch processing completes'],
    ['reconciliation.spec', 'discrepancy detection alert'],
    ['reconciliation.spec', 'audit trail complete'],
    ['reconciliation.spec', 'balance check passes'],
  ],
};

// testId helpers
function makeTestId(suite: string, file: string, name: string): string {
  return `${suite}::${file}::${name}`;
}

// Tests that always fail
const ALWAYS_FAILING = new Set<string>([
  makeTestId('payments', 'fraud.spec', 'device fingerprinting'),
  makeTestId('mobile', 'notifications.spec', 'filter by notification type'),
]);

// Flaky tests — alternate pass/fail per encounter
const FLAKY_TESTS = new Set<string>([
  makeTestId('api', 'auth.spec', 'refresh token'),
  makeTestId('web', 'checkout.spec', 'rejects expired card'),
  makeTestId('mobile', 'sync.spec', 'conflict resolution prefers server'),
  makeTestId('payments', 'webhooks.spec', 'replay attack prevention'),
  makeTestId('api', 'events.spec', 'dead letter queue'),
  makeTestId('mobile', 'push.spec', 'background fetch completes'),
]);

const flakyCounter = new Map<string, number>();

function getStatus(testId: string): Status {
  if (ALWAYS_FAILING.has(testId)) return 'failed';

  if (FLAKY_TESTS.has(testId)) {
    const count = flakyCounter.get(testId) ?? 0;
    flakyCounter.set(testId, count + 1);
    return count % 2 === 0 ? 'passed' : 'failed';
  }

  const r = rng();
  if (r < 0.02) return 'skipped';
  if (r < 0.10) return 'failed';
  return 'passed';
}

// --- Date helpers ---
const TODAY = new Date('2026-10-18T00:00:00Z');

function dayOffset(daysBack: number): Date {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d;
}

// --- Build seed data ---
mkdirSync('data', { recursive: true });
const DB_FILE = process.env.DB_PATH ?? 'data/testpulse.db';
if (existsSync(DB_FILE)) rmSync(DB_FILE);

const db = openDb(DB_FILE);
applySchema(db);

let runSeq = 0;

for (let daysBack = 29; daysBack >= 0; daysBack--) {
  const day = dayOffset(daysBack);
  const dateStr = day.toISOString().slice(0, 10);

  for (const suite of Object.keys(SUITES)) {
    const tests = SUITES[suite];
    const numRuns = randInt(1, 3);

    for (let ri = 0; ri < numRuns; ri++) {
      runSeq++;
      const runId = `run-${dateStr}-${suite}-${String(ri + 1).padStart(2, '0')}`;
      const hour = 6 + ri * 4 + randInt(0, 2);
      const startedAt = `${dateStr}T${String(hour).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}:00Z`;
      const durationMs = randInt(8000, 45000);

      const run: TestRun = {
        id: runId,
        suite,
        branch: 'main',
        commit: `c${(runSeq * 7919) % 0xffffff}`,
        startedAt,
        durationMs,
      };
      insertRun(db, run);

      const results: TestResult[] = tests.map(([file, name]) => {
        const testId = makeTestId(suite, file, name);
        const status = getStatus(testId);
        const dMs = randInt(20, 2000);
        const result: TestResult = { runId, testId, name, status, durationMs: dMs };
        if (status === 'failed') {
          result.message = `AssertionError: expected ${name} to pass`;
        }
        return result;
      });

      insertResults(db, results);
    }
  }
}

// --- Defects ---
const DEFECTS: Defect[] = [
  { id: 'BUG-101', testId: makeTestId('payments', 'fraud.spec', 'device fingerprinting'), title: 'Device fingerprinting service times out under load', severity: 'high', open: true },
  { id: 'BUG-102', testId: makeTestId('mobile', 'notifications.spec', 'filter by notification type'), title: 'Notification filter returns wrong type on iOS 17', severity: 'medium', open: true },
  { id: 'BUG-103', testId: makeTestId('web', 'checkout.spec', 'rejects expired card'), title: 'Expired card check intermittently passes in staging', severity: 'high', open: true },
  { id: 'BUG-104', testId: makeTestId('api', 'events.spec', 'dead letter queue'), title: 'Dead-letter queue not draining after restart', severity: 'medium', open: false },
  { id: 'BUG-105', testId: makeTestId('payments', 'webhooks.spec', 'replay attack prevention'), title: 'Webhook replay window is too wide (72h instead of 5min)', severity: 'critical', open: true },
  { id: 'BUG-106', testId: makeTestId('api', 'auth.spec', 'refresh token'), title: 'Refresh token race condition under concurrent requests', severity: 'low', open: false },
  { id: 'BUG-107', testId: makeTestId('mobile', 'sync.spec', 'conflict resolution prefers server'), title: 'Conflict resolution flips result on unstable connection', severity: 'medium', open: false },
  { id: 'BUG-108', testId: makeTestId('payments', 'reconciliation.spec', 'discrepancy detection alert'), title: 'Reconciliation alert fires false positive on weekends', severity: 'high', open: true },
  { id: 'BUG-109', testId: makeTestId('web', 'cart.spec', 'persists cart across sessions'), title: 'Cart not persisted when session cookie expires mid-flow', severity: 'low', open: false },
  { id: 'BUG-110', testId: makeTestId('mobile', 'push.spec', 'background fetch completes'), title: 'Background fetch silently dropped on Android 14', severity: 'medium', open: true },
];

for (const defect of DEFECTS) {
  insertDefect(db, defect);
}

console.log(`Seed complete. ${runSeq} runs inserted across 30 days.`);
