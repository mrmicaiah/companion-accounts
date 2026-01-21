// ============================================================
// SHARED TYPES
// ============================================================

export interface Env {
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SENDGRID_API_KEY: string;
  MAGIC_LINK_SECRET: string;
  INTERNAL_API_KEY: string;
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
  token: string;
  expires_at: string;
  created_at: string;
}

export interface Trial {
  id: string;
  chat_id: string;
  character: Character;
  messages_remaining: number;
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
}

export interface VerifyLinkResult {
  valid: boolean;
  email?: string;
  chatId?: string;
  character?: Character;
  error?: string;
}
