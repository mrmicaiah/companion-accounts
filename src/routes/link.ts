// ============================================================
// LINK ROUTES (Magic Link Flow)
// ============================================================

import { Env, Character, InitiateLinkResult, VerifyLinkResult } from '../types';
import { json } from '../index';
import { 
  createPendingLink, 
  getPendingLinkByToken,
  deletePendingLink,
  getAccountByEmail,
  createAccount,
  createTelegramLink,
  addCharacterToAccount,
  cleanExpiredPendingLinks
} from '../db/queries';
import { generateMagicToken } from '../services/token';
import { sendMagicLinkEmail } from '../services/email';

const CHARACTER_URLS: Record<Character, keyof Env> = {
  sadie: 'SADIE_URL',
  cole: 'COLE_URL',
  nora: 'NORA_URL',
  elliott: 'ELLIOTT_URL',
  clara: 'CLARA_URL',
  sean: 'SEAN_URL'
};

export async function handleLinkRoutes(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  
  // POST /link/initiate - User submits email, we send magic link
  if (path === '/link/initiate' && request.method === 'POST') {
    const body = await request.json() as { 
      email: string; 
      chatId: string; 
      character: Character;
      firstName?: string;
    };
    
    if (!body.email || !body.chatId || !body.character) {
      return json({ error: 'Missing email, chatId, or character' }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return json({ error: 'Invalid email format' }, 400);
    }

    // Clean up expired pending links
    await cleanExpiredPendingLinks(env.DB);

    // Generate magic link token (expires in 24 hours)
    const token = await generateMagicToken(env.MAGIC_LINK_SECRET);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Store pending link with firstName
    await createPendingLink(
      env.DB,
      body.email.toLowerCase().trim(),
      body.chatId,
      body.character,
      token,
      expiresAt,
      body.firstName
    );

    // Send email with magic link
    const magicLink = `https://topfivefriends.com/magic/${token}`;
    
    try {
      await sendMagicLinkEmail(
        env.RESEND_API_KEY,
        body.email,
        body.character,
        magicLink,
        body.firstName
      );
    } catch (error) {
      console.error('Failed to send email:', error);
      return json({ 
        success: false, 
        message: 'Failed to send email. Please try again.' 
      }, 500);
    }

    const result: InitiateLinkResult = {
      success: true,
      message: 'Magic link sent! Check your email.',
      token // Return token so character worker can track it
    };
    return json(result);
  }

  // GET /link/verify/:token - Validate magic link token
  const verifyMatch = path.match(/^\/link\/verify\/([^\/]+)$/);
  if (verifyMatch && request.method === 'GET') {
    const token = decodeURIComponent(verifyMatch[1]);

    const pending = await getPendingLinkByToken(env.DB, token);

    if (!pending) {
      const result: VerifyLinkResult = {
        valid: false,
        error: 'Invalid or expired link'
      };
      return json(result, 400);
    }

    // Check expiration
    if (new Date(pending.expires_at) < new Date()) {
      await deletePendingLink(env.DB, pending.id);
      const result: VerifyLinkResult = {
        valid: false,
        error: 'Link has expired. Please request a new one.'
      };
      return json(result, 400);
    }

    const result: VerifyLinkResult = {
      valid: true,
      email: pending.email,
      chatId: pending.chat_id,
      character: pending.character,
      firstName: pending.first_name
    };
    return json(result);
  }

  // POST /link/complete - Called after payment, finalizes account + link
  if (path === '/link/complete' && request.method === 'POST') {
    const body = await request.json() as { 
      token: string;
      stripeCustomerId?: string;
      characters: Character[];
    };

    if (!body.token || !body.characters?.length) {
      return json({ error: 'Missing token or characters' }, 400);
    }

    const pending = await getPendingLinkByToken(env.DB, body.token);
    
    if (!pending) {
      return json({ error: 'Invalid token' }, 400);
    }

    // Get or create account
    let account = await getAccountByEmail(env.DB, pending.email);
    
    if (!account) {
      account = await createAccount(env.DB, pending.email, body.stripeCustomerId);
    }

    // Link telegram to account
    await createTelegramLink(env.DB, pending.chat_id, account.id, pending.character);

    // Add selected characters to account
    for (const character of body.characters) {
      await addCharacterToAccount(env.DB, account.id, character);
    }

    // Update account status to active
    await env.DB
      .prepare('UPDATE accounts SET subscription_status = ?, updated_at = ? WHERE id = ?')
      .bind('active', new Date().toISOString(), account.id)
      .run();

    // Notify the character worker to activate the user
    const characterUrlKey = CHARACTER_URLS[pending.character];
    const characterUrl = env[characterUrlKey] as string | undefined;
    
    if (characterUrl) {
      try {
        await fetch(`${characterUrl}/billing/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: pending.chat_id,
            account_id: account.id,
            email: pending.email
          })
        });
      } catch (e) {
        console.error('Failed to notify character worker:', e);
      }
    }

    // Clean up pending link
    await deletePendingLink(env.DB, pending.id);

    return json({ 
      success: true, 
      accountId: account.id,
      message: 'Account linked successfully!'
    });
  }

  return json({ error: 'Not found' }, 404);
}
