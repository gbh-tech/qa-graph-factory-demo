import { DatabaseSync } from 'node:sqlite';

export function applySchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_runs (
      id          TEXT    PRIMARY KEY,
      suite       TEXT    NOT NULL,
      branch      TEXT    NOT NULL,
      commit_sha  TEXT    NOT NULL,
      started_at  TEXT    NOT NULL,
      duration_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS test_results (
      run_id      TEXT    NOT NULL,
      test_id     TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      status      TEXT    NOT NULL,
      duration_ms INTEGER NOT NULL,
      message     TEXT,
      PRIMARY KEY (run_id, test_id),
      FOREIGN KEY (run_id) REFERENCES test_runs(id)
    );

    CREATE TABLE IF NOT EXISTS defects (
      id       TEXT    PRIMARY KEY,
      test_id  TEXT    NOT NULL,
      title    TEXT    NOT NULL,
      severity TEXT    NOT NULL,
      open     INTEGER NOT NULL DEFAULT 1
    );
  `);
}
