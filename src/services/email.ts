// ============================================================
// EMAIL SERVICE (SendGrid)
// ============================================================

import { Character } from '../types';

const CHARACTER_NAMES: Record<Character, string> = {
  sadie: 'Sadie Hartley',
  cole: 'Cole Mercer',
  nora: 'Nora Vance',
  elliott: 'Elliott Sayer',
  clara: 'Clara Stone',
  sean: 'Sean Brennan'
};

const CHARACTER_DOMAINS: Record<Character, string> = {
  sadie: 'Fun & Play',
  cole: 'Health & Fitness',
  nora: 'Wealth & Finance',
  elliott: 'Mind & Clarity',
  clara: 'Spirit & Presence',
  sean: 'Relationships'
};

export async function sendMagicLinkEmail(
  apiKey: string,
  to: string,
  character: Character,
  magicLink: string
): Promise<void> {
  const characterName = CHARACTER_NAMES[character];
  const domain = CHARACTER_DOMAINS[character];

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { 
        email: 'hello@untitledpublishers.com', 
        name: 'AI Companions' 
      },
      subject: `Continue chatting with ${characterName}`,
      content: [
        {
          type: 'text/html',
          value: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #1a1a1a; margin-bottom: 10px;">AI Companions</h1>
  </div>
  
  <p>Hey there!</p>
  
  <p>You've been chatting with <strong>${characterName}</strong>, your ${domain} companion. To keep the conversation going, click the button below to choose your plan:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${magicLink}" style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Choose Your Plan</a>
  </div>
  
  <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  
  <p style="color: #888; font-size: 12px; text-align: center;">
    AI Companions by Untitled Publishers<br>
    Questions? Reply to this email.
  </p>
</body>
</html>
          `.trim()
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid error: ${response.status} - ${error}`);
  }
}
