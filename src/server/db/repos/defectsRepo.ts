import { DatabaseSync } from 'node:sqlite';
import type { Defect } from '../../../shared/types.ts';

export function insertDefect(db: DatabaseSync, defect: Defect): void {
  db.prepare(
    `INSERT INTO defects (id, test_id, title, severity, open) VALUES (?, ?, ?, ?, ?)`
  ).run(defect.id, defect.testId, defect.title, defect.severity, defect.open ? 1 : 0);
}

export function countOpenDefects(db: DatabaseSync): number {
  const row = db.prepare(`SELECT COUNT(*) AS cnt FROM defects WHERE open = 1`).get() as Record<string, unknown>;
  return row['cnt'] as number;
}
