import { mkdirSync } from 'node:fs';
import { createApp } from './app.ts';
import { getDb } from './db/connection.ts';
import { applySchema } from './db/schema.ts';
import { PORT } from './config.ts';

mkdirSync('data', { recursive: true });
const db = getDb();
applySchema(db);
const app = createApp(db);

app.listen(PORT, () => {
  console.log(`TestPulse listening on :${PORT}`);
});
