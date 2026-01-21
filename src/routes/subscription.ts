// ============================================================
// SUBSCRIPTION ROUTES (Stripe Integration)
// ============================================================

import { Env, Character } from '../types';
import { json } from '../index';
import { generateId, createAccount, getAccountByEmail, addCharacterToAccount, updateAccountStatus } from '../db/queries';

// Price IDs from Stripe (TEST MODE)
const PRICE_IDS = {
  single_monthly: 'price_1Ss9aYHSBCQi9g6mAxPYQJS4',
  // Add more test prices as needed
};

// Map price to tier (number of companions)
const PRICE_TO_TIER: Record<string, number> = {
  [PRICE_IDS.single_monthly]: 1,
};

// Pricing display info
const PRICING = {
  1: { monthly: 2999, yearly: 29900, name: '1 Companion' },
  2: { monthly: 4999, yearly: 49900, name: '2 Companions' },
  6: { monthly: 6999, yearly: 69900, name: 'All 6 Companions (Inner Circle)' }
};

export async function handleSubscriptionRoutes(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  
  // GET /subscription/pricing - Get pricing info
  if (path === '/subscription/pricing' && request.method === 'GET') {
    return json({
      pricing: PRICING,
      priceIds: PRICE_IDS,
      currency: 'usd'
    });
  }

  // POST /subscription/create-checkout - Create Stripe checkout session
  if (path === '/subscription/create-checkout' && request.method === 'POST') {
    const body = await request.json() as {
      email: string;
      priceId: string;
      tier?: number;
      characters?: string[];
      successUrl?: string;
      cancelUrl?: string;
      chatId?: string;
      character?: string;
    };

    if (!body.email || !body.priceId) {
      return json({ error: 'Missing email or priceId' }, 400);
    }

    // Get tier from mapping or from request body, default to 1
    const tier = PRICE_TO_TIER[body.priceId] || body.tier || 1;

    try {
      // Create Stripe checkout session
      const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'mode': 'subscription',
          'customer_email': body.email,
          'line_items[0][price]': body.priceId,
          'line_items[0][quantity]': '1',
          'success_url': body.successUrl || 'https://topfivefriends.com/success',
          'cancel_url': body.cancelUrl || 'https://topfivefriends.com/cancel',
          'metadata[email]': body.email,
          'metadata[tier]': tier.toString(),
          'metadata[characters]': body.characters?.join(',') || '',
          'metadata[chat_id]': body.chatId || '',
          'metadata[character]': body.character || '',
        }),
      });

      const session = await stripeResponse.json() as any;

      if (session.error) {
        console.error('Stripe error:', session.error);
        return json({ error: session.error.message }, 400);
      }

      return json({ 
        sessionId: session.id,
        url: session.url
      });
    } catch (error) {
      console.error('Checkout creation error:', error);
      return json({ error: 'Failed to create checkout session' }, 500);
    }
  }

  // POST /subscription/webhook - Stripe webhook handler
  if (path === '/subscription/webhook' && request.method === 'POST') {
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return json({ error: 'Missing signature' }, 400);
    }

    const body = await request.text();
    
    // Verify webhook signature
    const isValid = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return json({ error: 'Invalid signature' }, 400);
    }

    const event = JSON.parse(body);
    console.log('Stripe webhook event:', event.type);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(env, event.data.object);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpdate(env, event.data.object);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(env, event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await handlePaymentSucceeded(env, event.data.object);
          break;
        case 'invoice.payment_failed':
          await handlePaymentFailed(env, event.data.object);
          break;
        default:
          console.log('Unhandled event type:', event.type);
      }
    } catch (error) {
      console.error('Webhook handler error:', error);
      return json({ error: 'Webhook handler failed' }, 500);
    }

    return json({ received: true });
  }

  // GET /subscription/:accountId - Get subscription details
  const subMatch = path.match(/^\/subscription\/([^\/]+)$/);
  if (subMatch && request.method === 'GET') {
    const accountId = decodeURIComponent(subMatch[1]);

    const subscription = await env.DB
      .prepare('SELECT * FROM subscriptions WHERE account_id = ? ORDER BY created_at DESC LIMIT 1')
      .bind(accountId)
      .first();

    const characters = await env.DB
      .prepare('SELECT character FROM account_characters WHERE account_id = ?')
      .bind(accountId)
      .all<{ character: string }>();

    return json({
      subscription: subscription ?? null,
      characters: characters.results?.map(r => r.character) ?? []
    });
  }

  return json({ error: 'Not found' }, 404);
}

// ==================== WEBHOOK HANDLERS ====================

async function handleCheckoutCompleted(env: Env, session: any): Promise<void> {
  const email = session.customer_email || session.metadata?.email;
  const tier = parseInt(session.metadata?.tier || '1');
  const characters = session.metadata?.characters?.split(',').filter(Boolean) || [];
  const chatId = session.metadata?.chat_id;
  const character = session.metadata?.character;
  const customerId = session.customer;
  const subscriptionId = session.subscription;

  if (!email) {
    console.error('No email in checkout session');
    return;
  }

  // Get or create account
  let account = await getAccountByEmail(env.DB, email);
  if (!account) {
    account = await createAccount(env.DB, email, customerId);
  } else if (!account.stripe_customer_id) {
    // Update existing account with Stripe customer ID
    await env.DB.prepare('UPDATE accounts SET stripe_customer_id = ? WHERE id = ?')
      .bind(customerId, account.id)
      .run();
  }

  // Add subscription record
  const subId = generateId();
  await env.DB.prepare(`
    INSERT INTO subscriptions (id, account_id, stripe_subscription_id, tier, status, created_at)
    VALUES (?, ?, ?, ?, 'active', ?)
  `).bind(subId, account.id, subscriptionId, tier, new Date().toISOString()).run();

  // Update account status
  await updateAccountStatus(env.DB, account.id, 'active');

  // Add characters to account
  if (characters.length > 0) {
    for (const char of characters) {
      await addCharacterToAccount(env.DB, account.id, char as Character);
    }
  } else if (character) {
    // If single character from Telegram flow
    await addCharacterToAccount(env.DB, account.id, character as Character);
  }

  // If we have a chat_id, link the Telegram account and activate the bot
  if (chatId && character) {
    // Create telegram link
    const linkId = generateId();
    await env.DB.prepare(`
      INSERT OR REPLACE INTO telegram_links (id, chat_id, account_id, character, linked_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(linkId, chatId, account.id, character, new Date().toISOString()).run();

    // Notify the character bot to activate the user
    const charUrl = getCharacterUrl(env, character as Character);
    if (charUrl) {
      try {
        await fetch(`${charUrl}/billing/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, account_id: account.id, email })
        });
      } catch (e) {
        console.error('Failed to notify character bot:', e);
      }
    }
  }

  console.log(`Checkout completed for ${email}, tier ${tier}`);
}

async function handleSubscriptionUpdate(env: Env, subscription: any): Promise<void> {
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  await env.DB.prepare(`
    UPDATE subscriptions 
    SET status = ?, current_period_start = ?, current_period_end = ?
    WHERE stripe_subscription_id = ?
  `).bind(status, currentPeriodStart, currentPeriodEnd, subscriptionId).run();

  // Update account status based on subscription status
  const sub = await env.DB.prepare('SELECT account_id FROM subscriptions WHERE stripe_subscription_id = ?')
    .bind(subscriptionId)
    .first<{ account_id: string }>();

  if (sub) {
    const accountStatus = status === 'active' ? 'active' : (status === 'past_due' ? 'past_due' : 'canceled');
    await updateAccountStatus(env.DB, sub.account_id, accountStatus);
  }

  console.log(`Subscription ${subscriptionId} updated to ${status}`);
}

async function handleSubscriptionDeleted(env: Env, subscription: any): Promise<void> {
  const subscriptionId = subscription.id;

  // Get account before updating
  const sub = await env.DB.prepare('SELECT account_id FROM subscriptions WHERE stripe_subscription_id = ?')
    .bind(subscriptionId)
    .first<{ account_id: string }>();

  await env.DB.prepare('UPDATE subscriptions SET status = ? WHERE stripe_subscription_id = ?')
    .bind('canceled', subscriptionId)
    .run();

  if (sub) {
    await updateAccountStatus(env.DB, sub.account_id, 'canceled');
  }

  console.log(`Subscription ${subscriptionId} deleted/canceled`);
}

async function handlePaymentSucceeded(env: Env, invoice: any): Promise<void> {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  // Update subscription period
  const periodEnd = invoice.lines?.data?.[0]?.period?.end;
  if (periodEnd) {
    await env.DB.prepare('UPDATE subscriptions SET current_period_end = ?, status = ? WHERE stripe_subscription_id = ?')
      .bind(new Date(periodEnd * 1000).toISOString(), 'active', subscriptionId)
      .run();
  }

  console.log(`Payment succeeded for subscription ${subscriptionId}`);
}

async function handlePaymentFailed(env: Env, invoice: any): Promise<void> {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const sub = await env.DB.prepare('SELECT account_id FROM subscriptions WHERE stripe_subscription_id = ?')
    .bind(subscriptionId)
    .first<{ account_id: string }>();

  if (sub) {
    await updateAccountStatus(env.DB, sub.account_id, 'past_due');
  }

  console.log(`Payment failed for subscription ${subscriptionId}`);
}

// ==================== HELPERS ====================

function getCharacterUrl(env: Env, character: Character): string | undefined {
  const urls: Record<Character, string | undefined> = {
    cole: env.COLE_URL,
    nora: env.NORA_URL,
    elliott: env.ELLIOTT_URL,
    clara: env.CLARA_URL,
    sean: env.SEAN_URL,
    sadie: env.SADIE_URL,
  };
  return urls[character];
}

async function verifyStripeSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const parts = signature.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
    const v1Signature = parts.find(p => p.startsWith('v1='))?.split('=')[1];

    if (!timestamp || !v1Signature) {
      return false;
    }

    // Check timestamp is within 5 minutes
    const timestampNum = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampNum) > 300) {
      console.error('Webhook timestamp too old');
      return false;
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return expectedSignature === v1Signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}
