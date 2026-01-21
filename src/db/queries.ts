// ============================================================
// DATABASE QUERIES
// ============================================================

import { Account, Trial, TelegramLink, PendingLink, AccountCharacter, Character } from '../types';

// Generate unique IDs
export function generateId(): string {
  return crypto.randomUUID();
}

// ==================== TRIALS ====================

export async function getOrCreateTrial(
  db: D1Database,
  chatId: string,
  character: Character
): Promise<Trial> {
  // Try to get existing trial
  const existing = await db
    .prepare('SELECT * FROM trials WHERE chat_id = ? AND character = ?')
    .bind(chatId, character)
    .first<Trial>();

  if (existing) {
    return existing;
  }

  // Create new trial
  const id = generateId();
  await db
    .prepare('INSERT INTO trials (id, chat_id, character, messages_remaining) VALUES (?, ?, ?, 25)')
    .bind(id, chatId, character)
    .run();

  return {
    id,
    chat_id: chatId,
    character,
    messages_remaining: 25,
    created_at: new Date().toISOString()
  };
}

export async function decrementTrial(
  db: D1Database,
  chatId: string,
  character: Character
): Promise<number> {
  await db
    .prepare('UPDATE trials SET messages_remaining = messages_remaining - 1 WHERE chat_id = ? AND character = ? AND messages_remaining > 0')
    .bind(chatId, character)
    .run();

  const trial = await db
    .prepare('SELECT messages_remaining FROM trials WHERE chat_id = ? AND character = ?')
    .bind(chatId, character)
    .first<{ messages_remaining: number }>();

  return trial?.messages_remaining ?? 0;
}

// ==================== ACCOUNTS ====================

export async function getAccountByEmail(db: D1Database, email: string): Promise<Account | null> {
  return db
    .prepare('SELECT * FROM accounts WHERE email = ?')
    .bind(email)
    .first<Account>();
}

export async function getAccountById(db: D1Database, id: string): Promise<Account | null> {
  return db
    .prepare('SELECT * FROM accounts WHERE id = ?')
    .bind(id)
    .first<Account>();
}

export async function createAccount(
  db: D1Database,
  email: string,
  stripeCustomerId?: string
): Promise<Account> {
  const id = generateId();
  const now = new Date().toISOString();

  await db
    .prepare('INSERT INTO accounts (id, email, stripe_customer_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, email, stripeCustomerId ?? null, now, now)
    .run();

  return {
    id,
    email,
    stripe_customer_id: stripeCustomerId ?? null,
    subscription_status: 'trial',
    created_at: now,
    updated_at: now
  };
}

export async function updateAccountStatus(
  db: D1Database,
  accountId: string,
  status: string
): Promise<void> {
  await db
    .prepare('UPDATE accounts SET subscription_status = ?, updated_at = ? WHERE id = ?')
    .bind(status, new Date().toISOString(), accountId)
    .run();
}

// ==================== TELEGRAM LINKS ====================

export async function getTelegramLink(
  db: D1Database,
  chatId: string,
  character: Character
): Promise<TelegramLink | null> {
  return db
    .prepare('SELECT * FROM telegram_links WHERE chat_id = ? AND character = ?')
    .bind(chatId, character)
    .first<TelegramLink>();
}

export async function getAccountByChatId(
  db: D1Database,
  chatId: string
): Promise<Account | null> {
  const link = await db
    .prepare('SELECT account_id FROM telegram_links WHERE chat_id = ? LIMIT 1')
    .bind(chatId)
    .first<{ account_id: string }>();

  if (!link) return null;

  return getAccountById(db, link.account_id);
}

export async function createTelegramLink(
  db: D1Database,
  chatId: string,
  accountId: string,
  character: Character
): Promise<TelegramLink> {
  const id = generateId();
  const now = new Date().toISOString();

  await db
    .prepare('INSERT INTO telegram_links (id, chat_id, account_id, character, linked_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, chatId, accountId, character, now)
    .run();

  return { id, chat_id: chatId, account_id: accountId, character, linked_at: now };
}

// ==================== ACCOUNT CHARACTERS ====================

export async function getAccountCharacters(
  db: D1Database,
  accountId: string
): Promise<AccountCharacter[]> {
  const result = await db
    .prepare('SELECT * FROM account_characters WHERE account_id = ?')
    .bind(accountId)
    .all<AccountCharacter>();

  return result.results ?? [];
}

export async function hasCharacterAccess(
  db: D1Database,
  accountId: string,
  character: Character
): Promise<boolean> {
  const result = await db
    .prepare('SELECT id FROM account_characters WHERE account_id = ? AND character = ?')
    .bind(accountId, character)
    .first();

  return result !== null;
}

export async function addCharacterToAccount(
  db: D1Database,
  accountId: string,
  character: Character
): Promise<void> {
  const id = generateId();
  await db
    .prepare('INSERT OR IGNORE INTO account_characters (id, account_id, character) VALUES (?, ?, ?)')
    .bind(id, accountId, character)
    .run();
}

// ==================== PENDING LINKS ====================

export async function createPendingLink(
  db: D1Database,
  email: string,
  chatId: string,
  character: Character,
  token: string,
  expiresAt: string
): Promise<PendingLink> {
  const id = generateId();
  const now = new Date().toISOString();

  // Delete any existing pending links for this chat_id + character
  await db
    .prepare('DELETE FROM pending_links WHERE chat_id = ? AND character = ?')
    .bind(chatId, character)
    .run();

  await db
    .prepare('INSERT INTO pending_links (id, email, chat_id, character, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, email, chatId, character, token, expiresAt, now)
    .run();

  return { id, email, chat_id: chatId, character, token, expires_at: expiresAt, created_at: now };
}

export async function getPendingLinkByToken(
  db: D1Database,
  token: string
): Promise<PendingLink | null> {
  return db
    .prepare('SELECT * FROM pending_links WHERE token = ?')
    .bind(token)
    .first<PendingLink>();
}

export async function deletePendingLink(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM pending_links WHERE id = ?').bind(id).run();
}

export async function cleanExpiredPendingLinks(db: D1Database): Promise<void> {
  await db
    .prepare('DELETE FROM pending_links WHERE expires_at < ?')
    .bind(new Date().toISOString())
    .run();
}
