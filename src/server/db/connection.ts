import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from '../config.ts';

let instance: DatabaseSync | null = null;

export function openDb(path: string): DatabaseSync {
  return new DatabaseSync(path);
}

export function getDb(): DatabaseSync {
  if (!instance) {
    instance = openDb(DB_PATH);
  }
  return instance;
}
