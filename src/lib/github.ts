import "server-only";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import tar from "tar-stream";
import type { RepoMeta } from "./scanner/types";
import { shouldScan, type RepoFile } from "./scanner/scanRepo";

// Overridable for GitHub Enterprise, or a local mock in tests.
const API = process.env.GITHUB_API_URL ?? "https://api.github.com";
const MAX_REPO_KB = 150 * 1024; // skip repos over ~150 MB packed
const MAX_ENTRIES = 15000;
const MAX_SCANNED_BYTES = 40 * 1024 * 1024;

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function headers(token?: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "RepoGuard",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function gh<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(API + path, { headers: headers(token), signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (res.status === 404) throw new GitHubError("Not found on GitHub", 404);
  if (res.status === 403 || res.status === 429) throw new GitHubError("GitHub rate limit reached. Try again in a few minutes.", 429);
  if (!res.ok) throw new GitHubError(`GitHub returned ${res.status}`, 502);
  return (await res.json()) as T;
}

export const USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
export const REPONAME = /^[A-Za-z0-9._-]{1,100}$/;

export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  publicRepos: number;
}

export async function getUser(username: string, token?: string): Promise<GitHubUser> {
  const u = await gh<{ login: string; name: string | null; avatar_url: string; public_repos: number; type: string }>(`/users/${username}`, token);
  return { login: u.login, name: u.name, avatarUrl: u.avatar_url, publicRepos: u.public_repos };
}

export async function listRepos(username: string, token?: string): Promise<RepoMeta[]> {
  const out: RepoMeta[] = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await gh<
      { name: string; description: string | null; homepage: string | null; fork: boolean; archived: boolean; pushed_at: string; size: number; default_branch: string }[]
    >(`/users/${username}/repos?type=owner&per_page=100&page=${page}&sort=pushed`, token);
    for (const r of batch)
      out.push({
        name: r.name,
        description: r.description,
        homepage: r.homepage || null,
        fork: r.fork,
        archived: r.archived,
        pushedAt: r.pushed_at,
        sizeKb: r.size,
        defaultBranch: r.default_branch,
      });
    if (batch.length < 100) break;
  }
  return out;
}

/** The README of the username/username repo, which GitHub shows on the profile page. */
export async function getProfileReadme(username: string, token?: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/repos/${username}/${username}/readme`, {
      headers: { ...headers(token), Accept: "application/vnd.github.raw+json" },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    return res.ok ? (await res.text()).slice(0, 20000) : null;
  } catch {
    return null;
  }
}

/**
 * Download one repo as a tarball and read it in memory. One API request per repo,
 * instead of one per file. Nothing is written to disk.
 */
export async function fetchRepoFiles(owner: string, meta: RepoMeta, token?: string): Promise<{ files: RepoFile[]; allPaths: string[]; skipped?: string }> {
  if (meta.sizeKb > MAX_REPO_KB) return { files: [], allPaths: [], skipped: "Too large to scan in the browser version" };
  if (meta.sizeKb === 0) return { files: [], allPaths: [] };

  const res = await fetch(`${API}/repos/${owner}/${meta.name}/tarball/${encodeURIComponent(meta.defaultBranch)}`, {
    headers: headers(token),
    redirect: "follow",
    signal: AbortSignal.timeout(50000),
    cache: "no-store",
  });
  if (res.status === 404) return { files: [], allPaths: [], skipped: "Empty repository" };
  if (!res.ok || !res.body) throw new GitHubError(`Couldn't download ${meta.name} (${res.status})`, 502);

  const files: RepoFile[] = [];
  const allPaths: string[] = [];
  let scannedBytes = 0;
  let entries = 0;

  const extract = tar.extract();
  const done = new Promise<void>((resolve, reject) => {
    extract.on("entry", (header, stream, next) => {
      entries++;
      // Paths come prefixed with "owner-repo-sha/"
      const path = header.name.split("/").slice(1).join("/");
      if (header.type !== "file" || !path || entries > MAX_ENTRIES) {
        stream.resume();
        stream.on("end", next);
        return;
      }
      allPaths.push(path);
      const size = header.size ?? 0;
      if (!shouldScan(path, size) || scannedBytes + size > MAX_SCANNED_BYTES) {
        stream.resume();
        stream.on("end", next);
        return;
      }
      const chunks: Buffer[] = [];
      stream.on("data", (c: unknown) => {
        chunks.push(c as Buffer);
      });
      stream.on("end", () => {
        scannedBytes += size;
        files.push({ path, content: Buffer.concat(chunks).toString("utf8") });
        next();
      });
      stream.on("error", reject);
    });
    extract.on("finish", resolve);
    extract.on("error", reject);
  });

  const nodeStream = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);
  nodeStream.pipe(createGunzip()).on("error", (e) => extract.destroy(e)).pipe(extract);
  await done;
  return { files, allPaths, skipped: entries > MAX_ENTRIES ? "Only the first 15,000 files were checked" : undefined };
}

export interface CommitPatch {
  sha: string;
  files: { filename: string; patch?: string }[];
}

/** Recent commits with their diffs, for the owner's history scan. */
export async function listCommitPatches(owner: string, repo: string, token: string, max = 150): Promise<CommitPatch[]> {
  const shas: string[] = [];
  for (let page = 1; shas.length < max && page <= 3; page++) {
    let batch: { sha: string }[] = [];
    try {
      batch = await gh<{ sha: string }[]>(`/repos/${owner}/${repo}/commits?per_page=100&page=${page}`, token);
    } catch (e) {
      if (e instanceof GitHubError && (e.status === 404 || e.status === 502)) break; // empty repo returns 409
      throw e;
    }
    shas.push(...batch.map((c) => c.sha));
    if (batch.length < 100) break;
  }
  const out: CommitPatch[] = [];
  const queue = shas.slice(0, max);
  async function worker() {
    while (queue.length) {
      const sha = queue.shift()!;
      try {
        const c = await gh<{ sha: string; files?: { filename: string; patch?: string }[] }>(`/repos/${owner}/${repo}/commits/${sha}`, token);
        out.push({ sha: c.sha, files: (c.files ?? []).slice(0, 300) });
      } catch (e) {
        if (e instanceof GitHubError && e.status === 429) throw e;
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  return out;
}

/** Hosts we are willing to check. Anything else is refused, so this can't be used to probe other sites. */
export const DEMO_HOSTS = /^https:\/\/[a-z0-9-]+\.(herokuapp\.com|github\.io|netlify\.app|vercel\.app|onrender\.com|glitch\.me|repl\.co|pythonanywhere\.com|surge\.sh|firebaseapp\.com|web\.app)(\/[^\s]*)?$/i;

export async function isDeadLink(url: string): Promise<boolean> {
  const u = url.replace(/^http:\/\//i, "https://");
  if (!DEMO_HOSTS.test(u)) return false;
  try {
    const res = await fetch(u, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(7000), cache: "no-store", headers: { "User-Agent": "RepoGuard link check" } });
    res.body?.cancel().catch(() => {});
    return res.status === 404 || res.status === 410 || (/herokuapp\.com/i.test(u) && res.status >= 500);
  } catch (e) {
    // A slow site isn't a dead one. Only count lookups that fail outright (the host no longer exists).
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) return false;
    return true;
  }
}
