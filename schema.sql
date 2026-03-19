-- PM23FX Trade Journal — D1 Database Schema
-- Run this in your Cloudflare D1 console to set up the database

CREATE TABLE IF NOT EXISTS trades (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT,
  pair          TEXT NOT NULL,
  session       TEXT,
  direction     TEXT,
  entry_price   REAL,
  stop_loss     REAL,
  take_profit   REAL,
  exit_price    REAL,
  lot_size      REAL,
  result        TEXT,
  pips          REAL,
  pnl           REAL,
  broker_pnl    REAL,
  pnl_override  INTEGER DEFAULT 0,
  rr_ratio      REAL,
  strategy      TEXT,
  notes         TEXT,
  photo_before  TEXT,   -- base64 JPEG compressed
  photo_after   TEXT,   -- base64 JPEG compressed
  photo_broker  TEXT,   -- base64 JPEG compressed
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  id                INTEGER PRIMARY KEY,
  starting_balance  REAL DEFAULT 500,
  account_currency  TEXT DEFAULT 'QAR',
  updated_at        TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings row
INSERT OR IGNORE INTO settings (id, starting_balance, account_currency) VALUES (1, 500, 'QAR');

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_trades_date   ON trades(date DESC);
CREATE INDEX IF NOT EXISTS idx_trades_pair   ON trades(pair);
CREATE INDEX IF NOT EXISTS idx_trades_result ON trades(result);
