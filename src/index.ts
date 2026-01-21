// ============================================================
// COMPANION ACCOUNTS - Main Worker
// ============================================================

import { Env } from './types';
import { handleTrialRoutes } from './routes/trial';
import { handleAccessRoutes } from './routes/access';
import { handleLinkRoutes } from './routes/link';
import { handleSubscriptionRoutes } from './routes/subscription';

const VERSION = {
  version: '1.0.0',
  service: 'companion-accounts'
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for browser requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response: Response;

      // Health & version
      if (path === '/health') {
        response = json({ status: 'ok', ...VERSION });
      }
      else if (path === '/version') {
        response = new Response(`${VERSION.service} v${VERSION.version}`);
      }
      // Trial routes: /trial/*
      else if (path.startsWith('/trial')) {
        response = await handleTrialRoutes(request, env, path);
      }
      // Access routes: /access/*
      else if (path.startsWith('/access')) {
        response = await handleAccessRoutes(request, env, path);
      }
      // Link routes: /link/*
      else if (path.startsWith('/link')) {
        response = await handleLinkRoutes(request, env, path);
      }
      // Subscription routes: /subscription/*
      else if (path.startsWith('/subscription')) {
        response = await handleSubscriptionRoutes(request, env, path);
      }
      else {
        response = json({ error: 'Not found' }, 404);
      }

      // Add CORS headers to response
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
      
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders
      });

    } catch (error) {
      console.error('Unhandled error:', error);
      return json({ error: 'Internal server error' }, 500);
    }
  }
};

// Helper function for JSON responses
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
