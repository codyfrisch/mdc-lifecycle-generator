/**
 * Generate a simple client_id (MD5 format, 32 hex chars)
 */
export function generateClientId(appId: string): string {
  // Simple hash function to generate 32-char hex string
  let hash = 0;
  for (let i = 0; i < appId.length; i++) {
    const char = appId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to positive and pad to 32 hex chars
  const hex = Math.abs(hash).toString(16).padStart(32, "0").substring(0, 32);
  return hex;
}
