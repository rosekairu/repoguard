import type { Deduction, Finding, HygieneFacts, RecruiterView, RepoMeta, Severity } from "./types";

const ORDER: Record<Severity, number> = { critical: 0, high: 1, personal: 2, tidy: 3 };

/**
 * Merge findings from every repo. The same secret value pasted into several repos
 * becomes one finding ("in 4 repos") so one rotation fixes all of them.
 */
export function mergeFindings(all: Finding[]): Finding[] {
  const byValue = new Map<string, Finding[]>();
  const rest: Finding[] = [];
  for (const f of all) {
    if (!f.reuseKey) {
      rest.push(f);
      continue;
    }
    byValue.set(f.reuseKey, [...(byValue.get(f.reuseKey) ?? []), f]);
  }
  const merged: Finding[] = [];
  for (const list of byValue.values()) {
    const repos = [...new Set(list.map((f) => f.repo))];
    const first = list.find((f) => f.liveness === "live") ?? list[0];
    if (repos.length > 1) {
      merged.push({ ...first, title: `${first.title} reused in ${repos.length} repos`, alsoIn: repos.filter((r) => r !== first.repo) });
    } else {
      merged.push(first);
    }
  }
  return [...merged, ...rest].sort(
    (a, b) => ORDER[a.severity] - ORDER[b.severity] || (a.liveness === "live" ? -1 : 1) - (b.liveness === "live" ? -1 : 1) || a.repo.localeCompare(b.repo),
  );
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(text: string, n = 4): Set<string> {
  const w = words(text);
  const s = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(" "));
  return s;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Groups of repos whose READMEs are near copies of each other. */
export function findDuplicateGroups(hygiene: HygieneFacts[]): string[][] {
  const candidates = hygiene.filter((h) => h.hasReadme && !h.placeholderReadme && h.readmeText.length > 300);
  const raw = candidates.map((h) => ({ repo: h.repo, s: shingles(h.readmeText) }));
  // Many people reuse one README template (setup steps, licence text) across every project.
  // Phrases that appear in 5+ repos are template, not content, so they don't count as copying.
  const freq = new Map<string, number>();
  for (const { s } of raw) for (const x of s) freq.set(x, (freq.get(x) ?? 0) + 1);
  const sets = raw
    .map(({ repo, s }) => ({ repo, s: new Set([...s].filter((x) => (freq.get(x) ?? 0) < 5)) }))
    .filter((x) => x.s.size >= 20);
  const parent = new Map(sets.map((x) => [x.repo, x.repo]));
  const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!));
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++)
      if (jaccard(sets[i].s, sets[j].s) >= 0.8) parent.set(find(sets[i].repo), find(sets[j].repo));
  const groups = new Map<string, string[]>();
  for (const { repo } of sets) {
    const root = find(repo);
    groups.set(root, [...(groups.get(root) ?? []), repo]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

const THREE_YEARS_MS = 3 * 365 * 24 * 3600 * 1000;

export function buildRecruiterView(
  username: string,
  metas: RepoMeta[],
  hygiene: HygieneFacts[],
  deadLinks: Set<string>,
  profileReadme: string | null,
  now = Date.now(),
): RecruiterView {
  // The username/username repo is the profile README, not a project.
  const own = metas.filter((m) => !m.fork && !m.archived && m.name.toLowerCase() !== username.toLowerCase());
  const ownNames = new Set(own.map((m) => m.name));
  const res = hygiene.filter((h) => ownNames.has(h.repo));
  const deductions: Deduction[] = [];

  const dead = new Map<string, string[]>();
  for (const r of res) for (const l of r.demoLinks) if (deadLinks.has(l)) dead.set(r.repo, [...(dead.get(r.repo) ?? []), l]);
  for (const m of own) if (m.homepage && deadLinks.has(m.homepage)) dead.set(m.name, [...(dead.get(m.name) ?? []), m.homepage]);
  const deadCount = [...dead.values()].reduce((n, l) => n + new Set(l).size, 0);
  if (deadCount)
    deductions.push({
      id: "dead-links",
      points: Math.min(12, deadCount * 2),
      title: `${deadCount} demo link${deadCount > 1 ? "s are" : " is"} dead`,
      detail: [...dead.values()].flat().some((l) => /herokuapp/.test(l))
        ? "Heroku ended its free tier in November 2022. Redeploy, or swap each link for a screenshot."
        : "Redeploy them, or swap each link for a screenshot.",
      repos: [...dead.keys()],
    });

  const noReadme = res.filter((r) => !r.hasReadme).map((r) => r.repo);
  const placeholder = res.filter((r) => r.placeholderReadme).map((r) => r.repo);
  if (noReadme.length + placeholder.length)
    deductions.push({
      id: "readme",
      points: Math.min(10, Math.ceil((noReadme.length + placeholder.length) * 0.6)),
      title: [noReadme.length && `${noReadme.length} repo${noReadme.length > 1 ? "s" : ""} with no README`, placeholder.length && `${placeholder.length} with starter text`]
        .filter(Boolean)
        .join(", "),
      detail: "A README is the first thing anyone reads. Untouched framework boilerplate reads as unfinished work.",
      repos: [...noReadme, ...placeholder],
    });

  const dupes = findDuplicateGroups(res);
  if (dupes.length)
    deductions.push({
      id: "duplicates",
      points: Math.min(8, dupes.reduce((n, g) => n + (g.length - 1) * 3, 0)),
      title: dupes.length === 1 ? `${dupes[0].length} repos that are near copies` : `${dupes.length} groups of near-copy repos`,
      detail: "Keep the best one in each group and archive the rest.",
      repos: dupes.flat(),
    });

  const deps = res.filter((r) => r.committedDeps.length);
  if (deps.length)
    deductions.push({
      id: "deps",
      points: Math.min(7, deps.length * 2),
      title: `${deps.length} repo${deps.length > 1 ? "s include" : " includes"} node_modules or a virtualenv`,
      detail: "Thousands of library files bury your own code. Delete the folder and add it to .gitignore.",
      repos: deps.map((r) => r.repo),
    });

  const noDesc = own.filter((m) => !m.description?.trim());
  if (noDesc.length)
    deductions.push({
      id: "description",
      points: Math.min(5, Math.ceil(noDesc.length / 4)),
      title: `${noDesc.length} repo${noDesc.length > 1 ? "s have" : " has"} no description`,
      detail: "Your repository list shows a blank line under each name.",
      repos: noDesc.map((m) => m.name),
    });

  // Archive suggestions: old, and either unfinished, a duplicate, or a starter exercise
  const dupeLosers = new Set<string>();
  for (const g of dupes) {
    const sorted = [...g].sort((a, b) => Date.parse(metas.find((m) => m.name === b)!.pushedAt) - Date.parse(metas.find((m) => m.name === a)!.pushedAt));
    sorted.slice(1).forEach((r) => dupeLosers.add(r));
  }
  const archiveSuggestions = own
    .filter((m) => now - Date.parse(m.pushedAt) > THREE_YEARS_MS)
    .filter((m) => {
      const r = res.find((x) => x.repo === m.name);
      if (!r) return false;
      return (
        dupeLosers.has(m.name) ||
        !r.hasReadme ||
        r.placeholderReadme ||
        r.fileCount === 0 ||
        /^(hello[-_]?world|my[-_]first|test|practice|playground)/i.test(m.name)
      );
    })
    .map((m) => m.name);

  const score = Math.max(0, 100 - deductions.reduce((n, d) => n + d.points, 0));
  deductions.sort((a, b) => b.points - a.points);
  return {
    score,
    deductions,
    archiveSuggestions,
    profileReadmeIsStarter: Boolean(profileReadme && /Here are some ideas to get you started/i.test(profileReadme)),
  };
}
