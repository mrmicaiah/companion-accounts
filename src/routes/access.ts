// ============================================================
// ACCESS ROUTES
// ============================================================

import { Env, Character, AccessCheckResult } from '../types';
import { json } from '../index';
import { 
  getAccountByChatId, 
  hasCharacterAccess, 
  getOrCreateTrial,
  getTelegramLink 
} from '../db/queries';

export async function handleAccessRoutes(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  
  // GET /access/:chatId/:character - Check if chat_id has access to character
  const accessMatch = path.match(/^\/access\/([^\/]+)\/([^\/]+)$/);
  if (accessMatch && request.method === 'GET') {
    const chatId = decodeURIComponent(accessMatch[1]);
    const character = accessMatch[2] as Character;

    // Check if there's a linked account
    const account = await getAccountByChatId(env.DB, chatId);

    if (account && account.subscription_status === 'active') {
      // Check if this character is in their subscription
      const hasAccess = await hasCharacterAccess(env.DB, account.id, character);
      
      if (hasAccess) {
        const result: AccessCheckResult = {
          hasAccess: true,
          reason: 'subscribed',
          accountId: account.id,
          email: account.email
        };
        return json(result);
      } else {
        // Has account but not this character - they can upgrade
        const result: AccessCheckResult = {
          hasAccess: false,
          reason: 'no_access',
          accountId: account.id,
          email: account.email
        };
        return json(result);
      }
    }

    // No active subscription - check trial
    const trial = await getOrCreateTrial(env.DB, chatId, character);
    
    if (trial.messages_remaining > 0) {
      const result: AccessCheckResult = {
        hasAccess: true,
        reason: 'trial',
        trialRemaining: trial.messages_remaining,
        accountId: account?.id,
        email: account?.email
      };
      return json(result);
    }

    // Trial expired, no subscription
    const result: AccessCheckResult = {
      hasAccess: false,
      reason: 'trial_expired',
      trialRemaining: 0,
      accountId: account?.id,
      email: account?.email
    };
    return json(result);
  }

  // GET /access/:chatId - Get all characters this chat_id has access to
  const allAccessMatch = path.match(/^\/access\/([^\/]+)$/);
  if (allAccessMatch && request.method === 'GET') {
    const chatId = decodeURIComponent(allAccessMatch[1]);
    
    const account = await getAccountByChatId(env.DB, chatId);
    
    if (!account) {
      return json({ 
        hasAccount: false, 
        characters: [],
        subscription_status: null
      });
    }

    // Get all characters for this account
    const { results } = await env.DB
      .prepare('SELECT character FROM account_characters WHERE account_id = ?')
      .bind(account.id)
      .all<{ character: string }>();

    return json({
      hasAccount: true,
      accountId: account.id,
      email: account.email,
      subscription_status: account.subscription_status,
      characters: results?.map(r => r.character) ?? []
    });
  }

  return json({ error: 'Not found' }, 404);
}
