import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import type { Finding, PublicFinding, RepoScanResult } from "./scanner/types";

export interface Viewer {
  login?: string;
  accessToken?: string;
}

/** Who is asking. The access token is read from the encrypted session cookie, never from the browser. */
export async function getViewer(req: NextRequest): Promise<Viewer> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return {};
  const secureCookie = req.nextUrl.protocol === "https:";
  const token = await getToken({ req, secret, secureCookie, salt: secureCookie ? "__Secure-authjs.session-token" : "authjs.session-token" });
  if (!token) return {};
  return {
    login: typeof token.login === "string" ? token.login : undefined,
    accessToken: typeof token.accessToken === "string" ? token.accessToken : undefined,
  };
}

export function isOwner(viewer: Viewer, username: string): boolean {
  return Boolean(viewer.login && viewer.login.toLowerCase() === username.toLowerCase());
}

/** The token used to call GitHub: the owner's own when signed in, otherwise the app's read-only token. */
export function tokenFor(viewer: Viewer): string | undefined {
  return viewer.accessToken ?? process.env.GITHUB_TOKEN ?? undefined;
}

/**
 * A keyed fingerprint of a secret's hash. Safe to send to the owner's browser for spotting
 * reuse across repos: without the server key it can't be used to guess short passwords.
 */
export function reuseKey(valueHash: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "dev-only").update(valueHash).digest("hex").slice(0, 20);
}

export function withReuseKeys(findings: Finding[], valueHashes: Record<string, string>): Finding[] {
  return findings.map((f) => (valueHashes[f.id] ? { ...f, reuseKey: reuseKey(valueHashes[f.id]) } : f));
}

const PUBLIC_LABEL: Record<string, string> = {
  "password-assignment": "A password in plain text",
  "password-env": "A password in plain text",
  "connection-string": "A database connection string",
  "env-file": "An environment file",
  "api-key-assignment": "An API key or secret key",
  "api-key-env": "An API key or secret key",
  "aws-access-key": "A cloud access key",
  "github-token": "A GitHub token",
  "stripe-live-key": "A payment provider key",
  "slack-token": "A chat app token",
  "google-api-key": "A Google API key",
  "private-key": "A private key",
  "personal-data": "Personal data in test files",
};

/** Strip everything that would help someone find the leak: repo, path, line, value, context. */
export function toPublic(findings: Finding[], valueHashes: Record<string, string> = {}): PublicFinding[] {
  return findings.map((f) => ({
    k: valueHashes[f.id] ? reuseKey(valueHashes[f.id]) : undefined,
    severity: f.severity,
    label: f.title.startsWith("Email account") ? "An email account password" : f.title.startsWith("Password in a test") ? "A password in a test file" : (PUBLIC_LABEL[f.ruleId] ?? "A leaked secret"),
  }));
}

// Sealed results ----------------------------------------------------------
// A visitor's browser scans repo by repo, but must not learn WHICH repo leaks. So each repo's
// public result is encrypted with a server key. The browser hands all of them back at the end
// and gets only profile-wide counts. The summary refuses anything less than the full set of repos.

function sealKey(): Buffer {
  return createHash("sha256").update((process.env.AUTH_SECRET ?? "dev-only") + ":seal").digest();
}

interface SealedPayload {
  u: string;
  r: string;
  f: PublicFinding[];
  t: number;
}

export function seal(username: string, repo: string, findings: PublicFinding[]): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify({ u: username.toLowerCase(), r: repo, f: findings, t: Date.now() } satisfies SealedPayload)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unseal(token: string): SealedPayload | null {
  try {
    const raw = Buffer.from(token, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", sealKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const payload = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")) as SealedPayload;
    if (Date.now() - payload.t > 2 * 60 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

// Small in-memory cache. Keyed by push time, so a new push always gets a fresh scan.
const cache = new Map<string, { at: number; value: RepoScanResult }>();
const TTL = 60 * 60 * 1000;

export function cacheGet(key: string): RepoScanResult | undefined {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at > TTL) return undefined;
  return hit.value;
}

export function cacheSet(key: string, value: RepoScanResult) {
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
}

// Per-IP rate limit, so the app's GitHub token can't be burned by one visitor.
const hits = new Map<string, number[]>();

export function rateLimited(req: NextRequest, bucket: string, limit: number, windowMs = 60 * 60 * 1000): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const key = bucket + ":" + ip;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}
