export type Severity = "critical" | "high" | "personal" | "tidy";

export type Category = "secret" | "personal" | "hygiene";

/** Where a finding lives. "history" means it is gone from the default branch but still in old commits. */
export type Liveness = "live" | "history";

export interface Finding {
  /** Stable across scans for the same leak, so "mark fixed" can be checked next time. */
  id: string;
  ruleId: string;
  category: Category;
  severity: Severity;
  title: string;
  repo: string;
  path: string;
  line?: number;
  commit?: string;
  liveness: Liveness;
  /** The leaked value with most characters replaced. The raw value never leaves the scanner. */
  masked?: string;
  /** A few lines around the leak, with the secret itself masked. */
  context?: { line: number; text: string; hit: boolean }[];
  /** Extra notes, e.g. "looks made up" for synthetic test data. */
  note?: string;
  /** Count for grouped findings (e.g. 13 phone numbers in one file). */
  count?: number;
  /** Other repos where the same value appears. */
  alsoIn?: string[];
  /** Keyed fingerprint of the value (an HMAC, not the value or a plain hash) so the same key can be spotted across repos. */
  reuseKey?: string;
}

export interface RepoMeta {
  name: string;
  description: string | null;
  homepage: string | null;
  fork: boolean;
  archived: boolean;
  pushedAt: string;
  sizeKb: number;
  defaultBranch: string;
}

export interface HygieneFacts {
  repo: string;
  hasReadme: boolean;
  placeholderReadme: boolean;
  readmeText: string;
  committedDeps: string[];
  demoLinks: string[];
  fileCount: number;
}

export interface RepoScanResult {
  repo: string;
  findings: Finding[];
  hygiene: HygieneFacts;
  /** Fingerprints of secret values, used to spot the same key reused across repos. */
  valueHashes: Record<string, string>;
  skipped?: string;
}

export interface Deduction {
  id: string;
  points: number;
  title: string;
  detail: string;
  repos: string[];
}

export interface RecruiterView {
  score: number;
  deductions: Deduction[];
  archiveSuggestions: string[];
  profileReadmeIsStarter: boolean;
}

/** What anyone can see. No paths, lines, values or repo names attached to findings. */
export interface PublicFinding {
  severity: Severity;
  label: string;
  /** Server-only: lets the summary count a key reused in four repos once. Stripped before sending. */
  k?: string;
}
