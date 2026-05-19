import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

mkdirSync(dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS threads (
    phone       TEXT PRIMARY KEY,
    thread_id   TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
`);

const selectStmt = db.prepare('SELECT thread_id FROM threads WHERE phone = ?');
const insertStmt = db.prepare(
  'INSERT INTO threads (phone, thread_id, created_at, updated_at) VALUES (?, ?, ?, ?)'
);
const touchStmt = db.prepare('UPDATE threads SET updated_at = ? WHERE phone = ?');
const resetStmt = db.prepare('DELETE FROM threads WHERE phone = ?');

export function getThreadId(phone) {
  const row = selectStmt.get(phone);
  return row?.thread_id || null;
}

export function saveThread(phone, threadId) {
  const now = Date.now();
  insertStmt.run(phone, threadId, now, now);
}

export function touchThread(phone) {
  touchStmt.run(Date.now(), phone);
}

export function resetThread(phone) {
  resetStmt.run(phone);
}
