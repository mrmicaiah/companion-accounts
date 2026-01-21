// ============================================================
// TRIAL ROUTES
// ============================================================

import { Env, Character, TrialCheckResult } from '../types';
import { json } from '../index';
import { getOrCreateTrial, decrementTrial } from '../db/queries';

export async function handleTrialRoutes(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  
  // POST /trial/check - Check trial status
  if (path === '/trial/check' && request.method === 'POST') {
    const body = await request.json() as { chatId: string; character: Character };
    
    if (!body.chatId || !body.character) {
      return json({ error: 'Missing chatId or character' }, 400);
    }

    const trial = await getOrCreateTrial(env.DB, body.chatId, body.character);
    
    const result: TrialCheckResult = {
      hasTrialRemaining: trial.messages_remaining > 0,
      messagesRemaining: trial.messages_remaining,
      isNewTrial: trial.messages_remaining === 25
    };

    return json(result);
  }

  // POST /trial/decrement - Use a trial message
  if (path === '/trial/decrement' && request.method === 'POST') {
    const body = await request.json() as { chatId: string; character: Character };
    
    if (!body.chatId || !body.character) {
      return json({ error: 'Missing chatId or character' }, 400);
    }

    // Ensure trial exists
    await getOrCreateTrial(env.DB, body.chatId, body.character);
    
    // Decrement and get remaining
    const remaining = await decrementTrial(env.DB, body.chatId, body.character);

    return json({ 
      success: true, 
      messagesRemaining: remaining,
      trialExpired: remaining === 0
    });
  }

  return json({ error: 'Not found' }, 404);
}
