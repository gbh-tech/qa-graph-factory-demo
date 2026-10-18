export const PORT = Number(process.env.PORT ?? 3000);
export const DB_PATH = process.env.DB_PATH ?? 'data/testpulse.db';
export const INGEST_TIMEOUT_MS = 30_000;
export const MAX_REPORT_BYTES = 1_048_576; // 1 MB
