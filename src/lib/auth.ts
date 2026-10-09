function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export type AuthResult = "ok" | "denied" | "misconfigured";

export function checkBasicAuth(
  header: string | null,
  creds: { user?: string; password?: string },
): AuthResult {
  if (!creds.user || !creds.password || creds.password.length < 8) return "misconfigured";
  if (!header?.startsWith("Basic ")) return "denied";
  let decoded: string;
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0)));
  } catch {
    return "denied";
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return "denied";
  const userOk = safeEqual(decoded.slice(0, idx), creds.user);
  const passOk = safeEqual(decoded.slice(idx + 1), creds.password);
  return userOk && passOk ? "ok" : "denied";
}
