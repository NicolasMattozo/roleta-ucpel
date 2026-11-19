import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "ucpel_roleta_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 horas

export interface AdminAuthConfig {
  configured: boolean;
  password: string | null;
}

export function getAdminAuthConfig(): AdminAuthConfig {
  const envPassword = process.env.ADMIN_PASSWORD?.trim();
  if (envPassword) {
    return {
      configured: true,
      password: envPassword,
    };
  }

  return {
    configured: false,
    password: null,
  };
}

function getSigningKey(password: string): string {
  const extraEntropy = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "local-roleta";
  return createHmac("sha256", "ucpel-biomedicina-admin-key")
    .update(`${password}:${extraEntropy}`)
    .digest("hex");
}

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyAdminPassword(candidate: string): boolean {
  const config = getAdminAuthConfig();
  if (!config.configured || !config.password) return false;
  return safeEqualStrings(candidate.trim(), config.password);
}

export function createAdminSessionToken(): { token: string; maxAgeSeconds: number } {
  const config = getAdminAuthConfig();
  if (!config.configured || !config.password) {
    throw new Error("ADMIN_PASSWORD não configurada.");
  }
  const expiresAt = String(Date.now() + SESSION_TTL_MS);
  const sig = createHmac("sha256", getSigningKey(config.password))
    .update(expiresAt)
    .digest("hex");
  return {
    token: `${expiresAt}.${sig}`,
    maxAgeSeconds: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const config = getAdminAuthConfig();
  if (!config.configured || !config.password) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [expiresAtStr, providedSig] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false;
  }

  const expectedSig = createHmac("sha256", getSigningKey(config.password))
    .update(expiresAtStr)
    .digest("hex");

  return safeEqualStrings(providedSig, expectedSig);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}
