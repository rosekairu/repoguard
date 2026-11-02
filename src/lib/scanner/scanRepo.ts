import { PII_PATTERNS, isCommittedEnvFile, scanLineForSecrets } from "./rules";
import type { Finding, HygieneFacts, RepoScanResult } from "./types";
import { hash, isDataFile, looksFakeEmail, looksSequential, mask } from "./util";

export interface RepoFile {
  path: string;
  content: string;
}

const MAX_FILE_BYTES = 512 * 1024;

const TEST_PATH = /(^|\/)(tests?|spec|__tests__)\/|(^|\/)tests?\.py$|(^|\/)test_[^/]+$|_test\.\w+$|\.(test|spec)\.\w+$/i;

/** Dependency folders that should never be committed. */
const DEP_DIR = /(^|\/)(node_modules|venv|\.venv|virtual|virtualenv|env|bower_components|vendor\/bundle)\//;

/** Third-party or generated paths: scanning them only produces noise. */
const SKIP_PATH =
  /(^|\/)(node_modules|venv|\.venv|virtual|virtualenv|bower_components|vendor|dist|build|\.next|out|coverage|static_root|staticfiles|static_in_env|site-packages|__pycache__|\.git)\//i;
const SKIP_FILE =
  /(\.min\.(js|css)|\.map|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Gemfile\.lock|poetry\.lock|Pipfile\.lock|composer\.lock|\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|eot|otf|pdf|zip|gz|mp4|mp3|sqlite3?|db|pyc|class|jar|exe|dll|so))$/i;
const VENDOR_FILE = /(^|\/)(bootstrap|jquery|popper|fontawesome|font-awesome|angular|react|vue)[^/]*\.(js|css)$/i;

export function shouldScan(path: string, size: number): boolean {
  if (size > MAX_FILE_BYTES) return false;
  if (SKIP_PATH.test(path) || SKIP_FILE.test(path) || VENDOR_FILE.test(path)) return false;
  return true;
}

export function isBinary(content: string): boolean {
  return content.slice(0, 8000).includes("\u0000");
}

function contextLines(lines: string[], index: number, rawValue: string, masked: string) {
  const out: { line: number; text: string; hit: boolean }[] = [];
  for (let i = Math.max(0, index - 3); i <= Math.min(lines.length - 1, index + 1); i++) {
    // Mask the hit value everywhere it appears in the snippet, then cap the line length.
    let text = lines[i].split(rawValue).join(masked);
    text = text.replace(/((?:pass(?:word|wd)?|pwd|secret|token|key)\w*\s*[:=]\s*["']?)([^"'\s,]{6,})/gi, (_m, a: string, b: string) => a + mask(b));
    out.push({ line: i + 1, text: text.slice(0, 160), hit: i === index });
  }
  return out;
}

/**
 * Scan one repo's files. Pure function: no network, so it can be tested on any folder.
 * `allPaths` includes files that were too big or skipped, for hygiene checks.
 */
export function scanRepoFiles(repo: string, files: RepoFile[], allPaths: string[]): RepoScanResult {
  const findings: Finding[] = [];
  const valueHashes: Record<string, string> = {};

  for (const file of files) {
    if (isBinary(file.content)) continue;
    const lines = file.content.split(/\r?\n/);

    // 1. Secrets, line by line
    lines.forEach((line, i) => {
      const hit = scanLineForSecrets(line, file.path);
      if (!hit) return;
      const valueHash = hash(hit.ruleId.replace(/-(env|assignment)$/, "") + ":" + hit.value);
      if (findings.some((f) => f.id === hash(repo + valueHash))) return; // same value twice in one repo
      const masked = mask(hit.value);
      valueHashes[hash(repo + valueHash)] = valueHash;
      // A password inside a unit test is usually a made-up test user: still worth a look, not an emergency.
      const inTest = TEST_PATH.test(file.path) && hit.ruleId.startsWith("password");
      findings.push({
        id: hash(repo + valueHash),
        ruleId: hit.ruleId,
        category: "secret",
        severity: inTest ? "high" : hit.severity,
        title: inTest ? "Password in a test file" : hit.title,
        repo,
        path: file.path,
        line: i + 1,
        liveness: "live",
        masked,
        context: contextLines(lines, i, hit.value, masked),
        note: inTest
          ? "Probably a made-up test user. If it's a password you have used anywhere real, change it there."
          : hit.note,
      });
    });

    // 2. A committed .env file is a finding of its own, even if its values looked harmless
    if (isCommittedEnvFile(file.path) && lines.some((l) => /^\s*[A-Z_][A-Z0-9_]*\s*=\s*\S/.test(l))) {
      const id = hash(repo + "env-file:" + file.path);
      if (!findings.some((f) => f.path === file.path && f.severity === "critical")) {
        findings.push({
          id,
          ruleId: "env-file",
          category: "secret",
          severity: "high",
          title: ".env file committed",
          repo,
          path: file.path,
          liveness: "live",
          note: "Environment files usually hold every secret an app needs. Keep them out of git.",
        });
      }
    }

    // 3. Personal data, grouped per file
    const pii = scanPersonalData(file.path, file.content);
    if (pii) findings.push({ ...pii, repo, id: hash(repo + "pii:" + file.path) });
  }

  return { repo, findings, valueHashes, hygiene: collectHygiene(repo, files, allPaths) };
}

/**
 * Scan lines added in past commits. Anything found here that is not in the current
 * files is "only in history": deleted, but still readable by anyone who looks.
 */
export function scanCommitPatches(
  repo: string,
  patches: { sha: string; files: { filename: string; patch?: string }[] }[],
): { findings: Finding[]; valueHashes: Record<string, string> } {
  const findings = new Map<string, Finding>();
  const valueHashes: Record<string, string> = {};
  for (const commit of patches) {
    for (const file of commit.files) {
      if (!file.patch || !shouldScan(file.filename, file.patch.length)) continue;
      for (const raw of file.patch.split("\n")) {
        if (!raw.startsWith("+") || raw.startsWith("+++")) continue;
        const line = raw.slice(1);
        const hit = scanLineForSecrets(line, file.filename);
        if (!hit) continue;
        const valueHash = hash(hit.ruleId.replace(/-(env|assignment)$/, "") + ":" + hit.value);
        const id = hash(repo + valueHash);
        if (findings.has(id)) continue;
        const inTest = TEST_PATH.test(file.filename) && hit.ruleId.startsWith("password");
        const masked = mask(hit.value);
        valueHashes[id] = valueHash;
        findings.set(id, {
          id,
          ruleId: hit.ruleId,
          category: "secret",
          severity: inTest ? "high" : hit.severity,
          title: inTest ? "Password in a test file" : hit.title,
          repo,
          path: file.filename,
          commit: commit.sha.slice(0, 7),
          liveness: "history",
          masked,
          context: [{ line: 0, text: line.split(hit.value).join(masked).slice(0, 160), hit: true }],
          note: "Deleted from the current code, but anyone can still read it in this commit.",
        });
      }
    }
  }
  return { findings: [...findings.values()], valueHashes };
}

export function scanPersonalData(path: string, content: string): Omit<Finding, "repo" | "id"> | null {
  const data = isDataFile(path);
  const lower = path.toLowerCase();
  if (/(^|\/)(readme|license|licence|contributing|authors|code_of_conduct|changelog)[^/]*$/i.test(lower)) return null;

  const phones = new Set<string>(content.match(PII_PATTERNS.kenyanPhone) ?? []);
  if (data) for (const p of content.match(PII_PATTERNS.intlPhone) ?? []) if (p.replace(/\D/g, "").length >= 9) phones.add(p);
  const emails = data ? new Set((content.match(PII_PATTERNS.email) ?? []).filter((e) => !/noreply|no-reply|@users\.noreply/i.test(e))) : new Set<string>();
  const pins = new Set(content.match(PII_PATTERNS.kraPin) ?? []);
  const ids = new Set([...content.matchAll(PII_PATTERNS.nationalId)].map((m) => m[1]));

  const total = phones.size + emails.size + pins.size + ids.size;
  // Outside data files, one stray phone number is usually the author's own contact line.
  if (total === 0 || (!data && total < 3 && pins.size === 0 && ids.size === 0)) return null;

  const parts: string[] = [];
  if (phones.size) parts.push(`${phones.size} phone number${phones.size > 1 ? "s" : ""}`);
  if (emails.size) parts.push(`${emails.size} email${emails.size > 1 ? "s" : ""}`);
  if (ids.size) parts.push(`${ids.size} ID number${ids.size > 1 ? "s" : ""}`);
  if (pins.size) parts.push(`${pins.size} KRA PIN${pins.size > 1 ? "s" : ""}`);

  const checkable = [...[...emails].map(looksFakeEmail), ...[...phones].map(looksSequential)];
  const fakeShare = checkable.length ? checkable.filter(Boolean).length / checkable.length : 0;
  const allFake = fakeShare === 1 && pins.size === 0 && ids.size === 0;
  const mostlyFake = !allFake && fakeShare >= 0.75;

  return {
    ruleId: "personal-data",
    category: "personal",
    severity: "personal",
    title: `${joinParts(parts)} in ${/\.(sql|csv)$/i.test(path) ? "a data file" : data ? "test data" : "code"}`,
    path,
    liveness: "live",
    count: total,
    note: allFake
      ? "These look made up. If they are, mark them as not real and RepoGuard will stop flagging them."
      : mostlyFake
        ? "Most of these look made up, but a few look like real addresses or numbers. Check those, and replace anything real with made-up values."
        : "If these belong to real people, publishing them is a disclosure under the Kenya Data Protection Act and GDPR. Replace them with made-up values and remove them from history.",
  };
}

function joinParts(parts: string[]): string {
  if (parts.length <= 1) return capitalise(parts[0] ?? "");
  return capitalise(parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1]);
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Hygiene ------------------------------------------------------------------

const PLACEHOLDER_README = [
  /This README would normally document whatever steps are necessary/i,
  /^# \w[\w-]*\s*$/m,
];

export function isPlaceholderReadme(text: string): boolean {
  const t = text.trim();
  if (t.length < 200) return true;
  if (PLACEHOLDER_README[0].test(t)) return true;
  // Untouched Angular CLI / create-react-app / create-next-app starters
  const starter =
    /generated with \[Angular CLI\]/i.test(t) || /bootstrapped with \[Create React App\]/i.test(t) || /bootstrapped with \[`?create-next-app`?\]/i.test(t);
  if (starter && !/##\s*(description|about|features|author)/i.test(t)) return true;
  return false;
}

const DEMO_HOST = /https?:\/\/[^\s)"'<>\]]*(herokuapp\.com|github\.io|netlify\.app|vercel\.app|onrender\.com|glitch\.me|repl\.co|pythonanywhere\.com|surge\.sh|firebaseapp\.com|web\.app)[^\s)"'<>\]]*/gi;

function collectHygiene(repo: string, files: RepoFile[], allPaths: string[]): HygieneFacts {
  const readme = files.find((f) => /^readme(\.(md|markdown|txt|rst))?$/i.test(f.path));
  const deps = new Set<string>();
  for (const p of allPaths) {
    const m = DEP_DIR.exec(p);
    if (!m) continue;
    const dir = p.slice(0, m.index + m[0].length - 1);
    // "env/" and "virtual/" only count when they really are a Python environment
    if (/(^|\/)(env|virtual)$/.test(dir) && !allPaths.some((q) => q.startsWith(dir + "/") && /(pyvenv\.cfg|bin\/activate|site-packages)/.test(q))) continue;
    if ([...deps].some((d) => dir.startsWith(d + "/"))) continue;
    deps.add(dir);
  }
  const readmeText = readme?.content ?? "";
  return {
    repo,
    hasReadme: Boolean(readme),
    placeholderReadme: readme ? isPlaceholderReadme(readmeText) : false,
    readmeText: readmeText.slice(0, 20000),
    committedDeps: [...deps].slice(0, 5),
    demoLinks: [...new Set(readmeText.match(DEMO_HOST) ?? [])].map((u) => u.replace(/[.,)]+$/, "")).slice(0, 10),
    fileCount: allPaths.length,
  };
}
