import { createHash } from "node:crypto";

export function hash(value: string, length = 16): string {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

/** Keep the first three characters so the owner can recognise the value, hide the rest. */
export function mask(value: string): string {
  if (value.length <= 4) return "••••";
  // Fixed length, so the mask doesn't reveal how long the secret is.
  return value.slice(0, 3) + "••••••••";
}

/** Shannon entropy in bits per character. Real keys sit above ~3.5; words and placeholders sit lower. */
export function entropy(value: string): number {
  const counts = new Map<string, number>();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let bits = 0;
  for (const n of counts.values()) {
    const p = n / value.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

const PLACEHOLDER =
  /^(x+|\*+|\.+|-+|_+|0+|<.*>|\[.*\]|\$\{.*\}|\$[A-Z_]+|\{\{.*\}\}|\{.*\}|%.*%?|your[_-]?.*|my[_-]?(pass|password|pwd|secret|key|token).*|(db|database|user|admin|test|example)[_-]?pass(word)?\d{0,4}|pass(word)?\d{1,4}|change[_-]?(me|this|it)|replace[_-]?me|password|passw0rd|pass|secret|example|dummy|placeholder|sample|todo|tbd|null|none|nil|undefined|empty|redacted|hidden|enter[_ -].*|insert[_ -].*|\.\.\.)$/i;

export function isPlaceholder(value: string): boolean {
  const v = value.trim();
  if (v.length === 0) return true;
  if (PLACEHOLDER.test(v)) return true;
  if (/process\.env|os\.environ|getenv|ENV\[|config\(|settings\./i.test(v)) return true;
  if (/^(true|false|\d+)$/i.test(v)) return true;
  return false;
}

/** Files that hold data rather than logic: where personal data in a public repo usually hides. */
export function isDataFile(path: string): boolean {
  const p = path.toLowerCase();
  if (/(^|\/)(package(-lock)?\.json|composer\.json|tsconfig.*\.json|manifest\.json|app\.json)$/.test(p)) return false;
  if (/\.(sql|csv|tsv|xlsx?)$/.test(p)) return true;
  return /(seed|fixture|mock|fake|sample|dummy|testdata|test_data|dump|export)/.test(p);
}

export function isEnvOrShell(path: string): boolean {
  const base = path.split("/").pop()?.toLowerCase() ?? "";
  return /^\.env(\..+)?$/.test(base) || /\.(sh|bash|zsh|env|ini|cfg|conf|properties)$/.test(base) || base === "procfile";
}

/** True when the digits contain an obvious made-up run like 1234 or 5678. */
export function looksSequential(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  let run = 1;
  for (let i = 1; i < d.length; i++) {
    run = Number(d[i]) === Number(d[i - 1]) + 1 ? run + 1 : 1;
    if (run >= 4) return true;
  }
  return /(\d)\1{4,}/.test(d);
}

const FAKE_EMAIL_DOMAIN = /@(example\.(com|org|net)|test\.(com|org)|email\.com|domain\.com|fake[a-z]*\.[a-z]+|mailinator\.com|foo\.(com|bar)|sample\.com|acme\.(com|org)|.*\.test|.*\.example|.*\.invalid|.*\.local)$/i;

export function looksFakeEmail(email: string): boolean {
  return FAKE_EMAIL_DOMAIN.test(email);
}
