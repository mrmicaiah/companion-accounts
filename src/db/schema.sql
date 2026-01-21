-- ============================================================
-- COMPANION ACCOUNTS - D1 SCHEMA
-- ============================================================

-- Core accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'trial',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Which characters each account has access to
CREATE TABLE IF NOT EXISTS account_characters (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  character TEXT NOT NULL,
  added_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  UNIQUE(account_id, character)
);

-- Links telegram chat_ids to accounts
CREATE TABLE IF NOT EXISTS telegram_links (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  character TEXT NOT NULL,
  linked_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  UNIQUE(chat_id, character)
);

-- Temporary pending links (for magic link flow)
CREATE TABLE IF NOT EXISTS pending_links (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  character TEXT NOT NULL,
  first_name TEXT,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Trial tracking per chat_id per character
CREATE TABLE IF NOT EXISTS trials (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  character TEXT NOT NULL,
  messages_remaining INTEGER DEFAULT 25,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chat_id, character)
);

-- Stripe subscription tracking
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  tier INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  current_period_start TEXT,
  current_period_end TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_telegram_links_chat_id ON telegram_links(chat_id);
CREATE INDEX IF NOT EXISTS idx_trials_chat_character ON trials(chat_id, character);
CREATE INDEX IF NOT EXISTS idx_account_characters_account ON account_characters(account_id);
CREATE INDEX IF NOT EXISTS idx_pending_links_token ON pending_links(token);
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
