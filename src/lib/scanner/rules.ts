import type { Severity } from "./types";
import { entropy, isEnvOrShell, isPlaceholder } from "./util";

export interface SecretHit {
  ruleId: string;
  severity: Severity;
  title: string;
  /** The raw value. Used only for hashing and masking, never returned to a browser. */
  value: string;
  note?: string;
}

interface LineRule {
  id: string;
  severity: Severity;
  title: string | ((key: string) => string);
  pattern: RegExp;
  /** Which capture group holds the key name, if any. */
  keyGroup?: number;
  valueGroup: number;
  /** Only run on env files and shell scripts (for unquoted assignments). */
  envOnly?: boolean;
  accept?: (value: string, key: string, line: string) => boolean;
  note?: (value: string, line: string) => string | undefined;
}

const NOT_A_SECRET_KEY = /(hash|confirm|length|field|label|placeholder|input|reset|policy|regex|pattern|prompt|hint|strength|min|max|validator|rule|type|forgot|change|new_?pass|error|message|_url$|path)/i;

function passwordTitle(key: string): string {
  if (/mail|smtp|email/i.test(key)) return "Email account password";
  if (/db|database|postgres|mysql|mongo/i.test(key)) return "Database password";
  return "Password in plain text";
}

function keyTitle(key: string): string {
  if (/secret[_-]?key/i.test(key)) return "Secret key";
  if (/token/i.test(key)) return "Access token";
  if (/client[_-]?secret/i.test(key)) return "OAuth client secret";
  return "API key";
}

function goodPassword(value: string, key: string): boolean {
  if (NOT_A_SECRET_KEY.test(key)) return false;
  if (isPlaceholder(value)) return false;
  if (/\s/.test(value.trim()) && value.length > 24) return false; // a sentence, not a password
  return value.length >= 4;
}

function goodKey(value: string, key: string): boolean {
  if (/public|publishable|_url$|path|file/i.test(key)) return false;
  if (isPlaceholder(value)) return false;
  return value.length >= 16 && entropy(value) >= 3.2;
}

export const LINE_RULES: LineRule[] = [
  // Provider tokens with a known shape. GitHub's own scanner may also have caught these.
  { id: "aws-access-key", severity: "critical", title: "AWS access key", pattern: /\b((?:AKIA|ASIA)[0-9A-Z]{16})\b/, valueGroup: 1 },
  { id: "github-token", severity: "critical", title: "GitHub token", pattern: /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/, valueGroup: 1 },
  { id: "stripe-live-key", severity: "critical", title: "Stripe live secret key", pattern: /\b((?:sk|rk)_live_[0-9a-zA-Z]{24,})\b/, valueGroup: 1 },
  { id: "slack-token", severity: "critical", title: "Slack token", pattern: /\b(xox[baprs]-[A-Za-z0-9-]{10,})\b/, valueGroup: 1 },
  { id: "google-api-key", severity: "high", title: "Google API key", pattern: /\b(AIza[0-9A-Za-z_-]{35})\b/, valueGroup: 1 },
  { id: "private-key", severity: "critical", title: "Private key", pattern: /(-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----)/, valueGroup: 1 },

  // Connection strings with the password inside: postgresql://user:pass@host
  {
    id: "connection-string",
    severity: "high",
    title: "Database URL with password",
    pattern: /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|rediss?|amqps?|mssql)(?:\+\w+)?:\/\/[^:\s/@'"]+:([^@\s'"/]+)@([^\s'"/:?]+)/i,
    valueGroup: 1,
    accept: (v) => !isPlaceholder(v),
    note: (_v, line) =>
      /@(localhost|127\.0\.0\.1|0\.0\.0\.0|db|postgres|mysql)\b/i.test(line)
        ? "Points at a local database. Still change it if you have used this password anywhere else."
        : undefined,
  },

  // KEY = "value" style passwords in any language
  {
    id: "password-assignment",
    severity: "critical",
    title: passwordTitle,
    pattern: /["']?\b([A-Za-z0-9_.-]*(?:pass(?:word|wd)?|pwd))\b["']?\s*(?::|=|=>)\s*(["'`])([^"'`\n]{4,120})\2/i,
    keyGroup: 1,
    valueGroup: 3,
    accept: (v, k) => goodPassword(v, k),
  },
  // export MAIL_PASSWORD=value in .env and shell files, quoted or not
  {
    id: "password-env",
    severity: "critical",
    title: passwordTitle,
    pattern: /^\s*(?:export\s+)?([A-Z0-9_]*(?:PASSWORD|PASSWD|PASS|PWD))\s*=\s*["']?([^"'\s#]{4,120})/,
    keyGroup: 1,
    valueGroup: 2,
    envOnly: true,
    accept: (v, k) => goodPassword(v, k),
  },

  // API keys and secret keys
  {
    id: "api-key-assignment",
    severity: "high",
    title: keyTitle,
    pattern: /["']?\b([A-Za-z0-9_.-]*(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|app[_-]?secret))\b["']?\s*(?::|=|=>)\s*(["'`])([^"'`\s]{16,200})\2/i,
    keyGroup: 1,
    valueGroup: 3,
    accept: (v, k) => goodKey(v, k),
  },
  {
    id: "api-key-env",
    severity: "high",
    title: keyTitle,
    pattern: /^\s*(?:export\s+)?([A-Z0-9_]*(?:API_?KEY|SECRET_?KEY|ACCESS_?TOKEN|AUTH_?TOKEN|CLIENT_?SECRET|APP_?SECRET))\s*=\s*["']?([^"'\s#]{16,200})/,
    keyGroup: 1,
    valueGroup: 2,
    envOnly: true,
    accept: (v, k) => goodKey(v, k),
  },
];

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, personal: 2, tidy: 3 };

/** Run every secret rule over one line. At most one hit per line: the most severe. */
export function scanLineForSecrets(line: string, path: string): SecretHit | null {
  if (line.length > 2000) return null; // minified or generated
  const envFile = isEnvOrShell(path);
  let best: SecretHit | null = null;
  for (const rule of LINE_RULES) {
    if (rule.envOnly && !envFile) continue;
    const m = rule.pattern.exec(line);
    if (!m) continue;
    const value = m[rule.valueGroup];
    const key = rule.keyGroup ? m[rule.keyGroup] : "";
    if (!value) continue;
    if (rule.accept && !rule.accept(value, key, line)) continue;
    const title = typeof rule.title === "function" ? rule.title(key) : rule.title;
    const hit: SecretHit = { ruleId: rule.id, severity: rule.severity, title, value, note: rule.note?.(value, line) };
    if (!best || SEVERITY_RANK[hit.severity] < SEVERITY_RANK[best.severity]) best = hit;
  }
  return best;
}

export function isCommittedEnvFile(path: string): boolean {
  const base = path.split("/").pop() ?? "";
  return /^\.env(\.[\w-]+)?$/.test(base) && !/(example|sample|template|dist|defaults?)$/i.test(base);
}

// Personal data -----------------------------------------------------------

export const PII_PATTERNS = {
  /** Kenyan mobile numbers: 07xx, 01xx, +254, 254 */
  kenyanPhone: /(?<![\d+])(?:\+?254|0)[\s-]?(?:7\d{2}|1[01]\d)[\s-]?\d{3}[\s-]?\d{3}(?!\d)/g,
  /** International numbers written with a leading + (checked in data files only) */
  intlPhone: /(?<![\w+])\+(?!254)[1-9]\d{0,2}[\s-]?\d{2,4}(?:[\s-]?\d{2,4}){1,3}(?!\d)/g,
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  kraPin: /\b[AP]\d{9}[A-Z]\b/g,
  nationalId: /\b(?:national_?id|id_?(?:no|number)|idnumber)\b["']?\s*[:=]\s*["']?(\d{7,8})\b/gi,
};
