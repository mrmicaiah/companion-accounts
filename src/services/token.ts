// ============================================================
// MAGIC LINK TOKEN SERVICE
// ============================================================

/**
 * Generate a secure magic link token
 */
export async function generateMagicToken(secret: string): Promise<string> {
  // Generate random bytes
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  
  // Convert to hex string
  const token = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return token;
}

/**
 * Verify a magic link token (basic validation)
 * The actual validation happens by looking up the token in pending_links table
 */
export async function verifyMagicToken(token: string, secret: string): Promise<boolean> {
  // Token should be 64 hex characters (32 bytes)
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return false;
  }
  return true;
}
