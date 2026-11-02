/**
 * Run the scanner on folders already on disk, with no GitHub API calls.
 * Usage: npm run scan:local -- /path/to/folder-of-repos
 * Prints findings with values masked, the same way the app shows them.
 */
import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";
import { scanRepoFiles, shouldScan, type RepoFile } from "../src/lib/scanner/scanRepo";
import { buildRecruiterView, mergeFindings } from "../src/lib/scanner/profile";
import type { RepoMeta } from "../src/lib/scanner/types";

const root = process.argv[2];
if (!root) throw new Error("Pass a folder that contains cloned repos");

function walk(dir: string, base: string, out: { path: string; size: number }[]) {
  for (const name of readdirSync(dir)) {
    if (name === ".git") continue;
    const full = join(dir, name);
    const st = lstatSync(full);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) walk(full, base, out);
    else out.push({ path: relative(base, full), size: st.size });
  }
}

const results = [];
const metas: RepoMeta[] = [];
for (const repo of readdirSync(root)) {
  const dir = join(root, repo);
  if (!statSync(dir).isDirectory()) continue;
  const all: { path: string; size: number }[] = [];
  walk(dir, dir, all);
  const files: RepoFile[] = all.filter((f) => shouldScan(f.path, f.size)).map((f) => ({ path: f.path, content: readFileSync(join(dir, f.path), "utf8") }));
  results.push(scanRepoFiles(repo, files, all.map((f) => f.path)));
  let pushed = new Date().toISOString();
  try {
    pushed = execSync(`git -C ${dir} log -1 --format=%cI`, { encoding: "utf8" }).trim() || pushed;
  } catch {}
  metas.push({ name: repo, description: null, homepage: null, fork: false, archived: false, pushedAt: pushed, sizeKb: 0, defaultBranch: "main" });
}

const findings = mergeFindings(results.flatMap((r) => r.findings.map((f) => ({ ...f, reuseKey: r.valueHashes[f.id] }))));
for (const f of findings) {
  console.log(`[${f.severity}] ${f.title} :: ${f.repo}/${f.path}${f.line ? ":" + f.line : ""} ${f.masked ?? ""} ${f.alsoIn ? "(also " + f.alsoIn.join(", ") + ")" : ""}${f.note ? "\n      note: " + f.note : ""}`);
}
const dead = new Set(results.flatMap((r) => r.hygiene.demoLinks).filter((l) => /herokuapp/.test(l)));
const rv = buildRecruiterView("rosekairu", metas, results.map((r) => r.hygiene), dead, null);
console.log("\nRecruiter score:", rv.score);
for (const d of rv.deductions) console.log(`  -${d.points} ${d.title} [${d.repos.join(", ")}]`);
console.log("Archive suggestions:", rv.archiveSuggestions.join(", "));
