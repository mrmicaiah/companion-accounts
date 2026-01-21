// ============================================================
// SUBSCRIPTION ROUTES (Stripe Integration)
// ============================================================

import { Env } from '../types';
import { json } from '../index';

// Pricing tiers
const PRICING = {
  1: { price: 1999, name: '1 Character' },
  2: { price: 3499, name: '2 Characters' },
  4: { price: 5999, name: '4 Characters' },
  6: { price: 7999, name: 'All 6 Characters' }
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
      currency: 'usd',
      interval: 'month'
    });
  }

  // POST /subscription/checkout - Create Stripe checkout session
  if (path === '/subscription/checkout' && request.method === 'POST') {
    const body = await request.json() as {
      token: string;  // Magic link token to identify user
      tier: number;   // 1, 2, 4, or 6
      characters: string[];  // Selected characters
      successUrl: string;
      cancelUrl: string;
    };

    if (!body.token || !body.tier || !body.characters?.length) {
      return json({ error: 'Missing required fields' }, 400);
    }

    if (!PRICING[body.tier as keyof typeof PRICING]) {
      return json({ error: 'Invalid tier' }, 400);
    }

    // Validate character count matches tier
    if (body.characters.length !== body.tier) {
      return json({ error: `Tier ${body.tier} requires exactly ${body.tier} characters` }, 400);
    }

    // TODO: Create Stripe checkout session
    // For now, return placeholder
    return json({ 
      message: 'Stripe integration pending',
      tier: body.tier,
      characters: body.characters,
      price: PRICING[body.tier as keyof typeof PRICING]
    });
  }

  // POST /subscription/webhook - Stripe webhook handler
  if (path === '/subscription/webhook' && request.method === 'POST') {
    // TODO: Implement Stripe webhook handling
    // - Verify webhook signature
    // - Handle checkout.session.completed
    // - Handle invoice.paid
    // - Handle customer.subscription.updated
    // - Handle customer.subscription.deleted
    
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
