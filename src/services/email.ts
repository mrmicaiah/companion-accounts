// ============================================================
// EMAIL SERVICE (Resend)
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
  magicLink: string,
  firstName?: string
): Promise<void> {
  const characterName = CHARACTER_NAMES[character];
  const greeting = firstName ? `hey ${firstName}!` : 'hey there!';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${characterName} <no-reply@topfivefriends.com>`,
      to: [to],
      subject: `${greeting} your link to keep chatting 💬`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
  
  <h1 style="font-size: 24px; font-weight: 600; color: #1a1a1a; margin-bottom: 24px;">
    ${greeting} 👋
  </h1>
  
  <p style="font-size: 16px; line-height: 1.6; color: #4a4a4a; margin-bottom: 16px;">
    it's ${characterName} — you clicked through! i'm so glad you want to keep talking.
  </p>
  
  <p style="font-size: 16px; line-height: 1.6; color: #4a4a4a; margin-bottom: 32px;">
    click the button below to pick your plan and we can get back to it:
  </p>
  
  <a href="${magicLink}" style="display: inline-block; background: #7c3aed; color: white; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none; margin-bottom: 32px;">
    Choose Your Plan →
  </a>
  
  <p style="font-size: 14px; color: #888; margin-top: 32px;">
    this link expires in 24 hours. if you didn't request this, you can ignore it.
  </p>
  
  <p style="font-size: 14px; color: #888; margin-top: 24px;">
    — ${characterName} 💜<br>
    <span style="color: #aaa;">Top Five Friends</span>
  </p>
</body>
</html>
      `.trim()
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend error: ${response.status} - ${error}`);
  }
}
