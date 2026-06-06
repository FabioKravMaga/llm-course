import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

mkdirSync(dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    phone              TEXT PRIMARY KEY,
    thread_id          TEXT NOT NULL,
    stage              TEXT NOT NULL DEFAULT 'new',
    client_name        TEXT,
    case_type          TEXT,
    case_summary       TEXT,
    urgency            TEXT,
    fee_amount         REAL,
    payment_terms      TEXT,
    scope              TEXT,
    contract_id        TEXT,
    contract_sign_url  TEXT,
    contract_pdf_path  TEXT,
    lost_reason        TEXT,
    last_inbound_at    INTEGER,
    last_outbound_at   INTEGER,
    follow_up_count    INTEGER NOT NULL DEFAULT 0,
    follow_up_next_at  INTEGER,
    notes              TEXT,
    created_at         INTEGER NOT NULL,
    updated_at         INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_leads_followup
    ON leads(follow_up_next_at) WHERE follow_up_next_at IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
`);

const selectStmt = db.prepare('SELECT * FROM leads WHERE phone = ?');
const insertStmt = db.prepare(`
  INSERT INTO leads (phone, thread_id, stage, created_at, updated_at)
  VALUES (?, ?, 'new', ?, ?)
`);
const deleteStmt = db.prepare('DELETE FROM leads WHERE phone = ?');
const dueFollowUpStmt = db.prepare(`
  SELECT * FROM leads
  WHERE follow_up_next_at IS NOT NULL
    AND follow_up_next_at <= ?
    AND stage NOT IN ('signed', 'lost')
  ORDER BY follow_up_next_at ASC
  LIMIT 50
`);
const findByContractStmt = db.prepare('SELECT * FROM leads WHERE contract_id = ?');

const updatableFields = new Set([
  'thread_id',
  'stage',
  'client_name',
  'case_type',
  'case_summary',
  'urgency',
  'fee_amount',
  'payment_terms',
  'scope',
  'contract_id',
  'contract_sign_url',
  'contract_pdf_path',
  'lost_reason',
  'last_inbound_at',
  'last_outbound_at',
  'follow_up_count',
  'follow_up_next_at',
  'notes'
]);

export function getLead(phone) {
  return selectStmt.get(phone) || null;
}

export function createLead(phone, threadId) {
  const now = Date.now();
  insertStmt.run(phone, threadId, now, now);
  return getLead(phone);
}

export function updateLead(phone, patch) {
  const entries = Object.entries(patch).filter(([k]) => updatableFields.has(k));
  if (!entries.length) return getLead(phone);
  const cols = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);
  db.prepare(`UPDATE leads SET ${cols}, updated_at = ? WHERE phone = ?`).run(
    ...values,
    Date.now(),
    phone
  );
  return getLead(phone);
}

export function deleteLead(phone) {
  deleteStmt.run(phone);
}

export function findLeadByContract(contractId) {
  return findByContractStmt.get(contractId) || null;
}

export function dueFollowUps(now = Date.now()) {
  return dueFollowUpStmt.all(now);
}
