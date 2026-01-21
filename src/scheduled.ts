// ============================================================
// SCHEDULED HANDLER - Trial Bump Follow-ups
// ============================================================

import { Env, Character } from './types';

// Character-specific follow-up messages
const BUMP_MESSAGES: Record<Character, string> = {
  cole: "You went quiet on me. That's fine - but I'm not done with you yet. 10 more. Let's see what you're made of.",
  nora: "I'll float you 10 more. Consider it a small investment in figuring out if I'm worth it.",
  elliott: "Noticed you stepped back. That's usually when the real work starts. Come back. 10 more, no strings.",
  sean: "Look, relationships take time to build. 10 more messages - let's keep going.",
  clara: "Sometimes we need space before we're ready. I'm here when you are. 10 more.",
  sadie: "Hey stranger! Miss me? 10 more on the house. Let's play."
};

// Map character to their bot token env key
function getBotToken(env: Env, character: Character): string | undefined {
  const tokenMap: Record<Character, string | undefined> = {
    cole: env.COLE_BOT_TOKEN,
    nora: env.NORA_BOT_TOKEN,
    elliott: env.ELLIOTT_BOT_TOKEN,
    clara: env.CLARA_BOT_TOKEN,
    sean: env.SEAN_BOT_TOKEN,
    sadie: env.SADIE_BOT_TOKEN
  };
  return tokenMap[character];
}

// Send a Telegram message
async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text
      })
    });
    
    if (!response.ok) {
      console.error(`Telegram API error: ${response.status}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return false;
  }
}

export async function handleScheduled(env: Env): Promise<void> {
  console.log('Running trial bump cron job...');
  
  // Find trials that:
  // - Have 0 messages remaining
  // - Haven't received a bump yet
  // - Exhausted more than 24 hours ago
  const result = await env.DB.prepare(`
    SELECT chat_id, character 
    FROM trials
    WHERE messages_remaining = 0
      AND bump_given = 0
      AND trial_exhausted_at IS NOT NULL
      AND trial_exhausted_at < datetime('now', '-24 hours')
  `).all();
  
  if (!result.results || result.results.length === 0) {
    console.log('No trials to bump');
    return;
  }
  
  console.log(`Found ${result.results.length} trials to bump`);
  
  for (const row of result.results) {
    const chatId = row.chat_id as string;
    const character = row.character as Character;
    
    const botToken = getBotToken(env, character);
    if (!botToken) {
      console.error(`No bot token for character: ${character}`);
      continue;
    }
    
    const message = BUMP_MESSAGES[character];
    const sent = await sendTelegramMessage(botToken, chatId, message);
    
    if (sent) {
      // Update trial: give 10 more messages, mark bump as given
      await env.DB.prepare(`
        UPDATE trials
        SET messages_remaining = 10, bump_given = 1
        WHERE chat_id = ? AND character = ?
      `).bind(chatId, character).run();
      
      console.log(`Bumped trial for ${chatId} with ${character}`);
    }
  }
  
  console.log('Trial bump cron job complete');
}
