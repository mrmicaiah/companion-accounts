// ============================================================
// SHARED TYPES
// ============================================================

export interface Env {
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
  MAGIC_LINK_SECRET: string;
  INTERNAL_API_KEY: string;
  // Character worker URLs for callbacks
  SADIE_URL?: string;
  COLE_URL?: string;
  NORA_URL?: string;
  ELLIOTT_URL?: string;
  CLARA_URL?: string;
  SEAN_URL?: string;
  // Bot tokens for cron follow-ups
  COLE_BOT_TOKEN?: string;
  NORA_BOT_TOKEN?: string;
  ELLIOTT_BOT_TOKEN?: string;
  CLARA_BOT_TOKEN?: string;
  SEAN_BOT_TOKEN?: string;
  SADIE_BOT_TOKEN?: string;
}

export type Character = 'sadie' | 'cole' | 'nora' | 'elliott' | 'clara' | 'sean';

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled';

export interface Account {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  subscription_status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
}

export interface AccountCharacter {
  id: string;
  account_id: string;
  character: Character;
  added_at: string;
}

export interface TelegramLink {
  id: string;
  chat_id: string;
  account_id: string;
  character: Character;
  linked_at: string;
}

export interface PendingLink {
  id: string;
  email: string;
  chat_id: string;
  character: Character;
  first_name?: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface Trial {
  id: string;
  chat_id: string;
  character: Character;
  messages_remaining: number;
  trial_exhausted_at: string | null;
  bump_given: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  account_id: string;
  stripe_subscription_id: string;
  tier: number;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}

// API Response Types

export interface AccessCheckResult {
  hasAccess: boolean;
  reason: 'subscribed' | 'trial' | 'no_access' | 'trial_expired';
  trialRemaining?: number;
  accountId?: string;
  email?: string;
}

export interface TrialCheckResult {
  hasTrialRemaining: boolean;
  messagesRemaining: number;
  isNewTrial: boolean;
}

export interface InitiateLinkResult {
  success: boolean;
  message: string;
  token?: string;
}

export interface VerifyLinkResult {
  valid: boolean;
  email?: string;
  chatId?: string;
  character?: Character;
  firstName?: string;
  error?: string;
}
