/**
 * A tiny stand-in for the GitHub API, serving repos cloned on disk. Test use only.
 * Usage: tsx tests/e2e/mock-github.ts <folder-of-clones> <username> [port]
 */
import { createServer } from "node:http";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const [root, user, portArg] = process.argv.slice(2);
const port = Number(portArg ?? 4010);
const repos = readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory());
const git = (repo: string, ...args: string[]) => execFileSync("git", ["-C", join(root, repo), ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const hasCommits = (r: string) => { try { git(r, "rev-parse", "HEAD"); return true; } catch { return false; } };

const DESCRIPTIONS: Record<string, string> = { GitSearch: "An Angular app that lets users search GitHub", Quotes: "Create and vote on quotes" };

function meta(r: string) {
  const pushed = hasCommits(r) ? git(r, "log", "-1", "--format=%cI").trim() : "2021-11-18T00:00:00Z";
  return { name: r, description: DESCRIPTIONS[r] ?? null, homepage: null, fork: false, archived: false, pushed_at: pushed, size: hasCommits(r) ? 100 : 0, default_branch: "HEAD" };
}

createServer((req, res) => {
  const url = new URL(req.url!, `http://localhost:${port}`);
  const p = url.pathname;
  const json = (body: unknown, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  let m;
  if (p === `/users/${user}`) return json({ login: user, name: "Test User", avatar_url: "", public_repos: repos.length, type: "User" });
  if (p === `/users/${user}/repos`) return json(url.searchParams.get("page") === "1" ? repos.map(meta) : []);
  if (p === `/repos/${user}/${user}/readme`) {
    const f = join(root, user, "README.md");
    if (!existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200); return res.end(readFileSync(f));
  }
  if ((m = p.match(/^\/repos\/[^/]+\/([^/]+)\/tarball\//))) {
    const r = decodeURIComponent(m[1]);
    if (!hasCommits(r)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": "application/x-gzip" });
    const child = spawn("git", ["-C", join(root, r), "archive", "--format=tar.gz", `--prefix=${user}-${r}-abc123/`, "HEAD"]);
    return child.stdout.pipe(res);
  }
  if ((m = p.match(/^\/repos\/[^/]+\/([^/]+)\/commits$/))) {
    const r = decodeURIComponent(m[1]);
    if (!hasCommits(r) || url.searchParams.get("page") !== "1") return json([]);
    return json(git(r, "log", "--format=%H", "-n", "100").trim().split("\n").filter(Boolean).map((sha) => ({ sha })));
  }
  if ((m = p.match(/^\/repos\/[^/]+\/([^/]+)\/commits\/([0-9a-f]+)$/))) {
    const [r, sha] = [decodeURIComponent(m[1]), m[2]];
    const names = git(r, "show", "--format=", "--name-only", sha).trim().split("\n").filter(Boolean).slice(0, 60);
    const files = names.map((filename) => {
      let patch = "";
      try { patch = git(r, "show", "--format=", sha, "--", filename).split("\n").slice(4).join("\n").slice(0, 200000); } catch {}
      return { filename, patch };
    });
    return json({ sha, files });
  }
  json({ message: "Not Found" }, 404);
}).listen(port, () => console.log(`mock github on ${port} serving ${repos.length} repos`));
