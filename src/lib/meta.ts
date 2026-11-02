import "server-only";
import { listRepos } from "./github";
import type { RepoMeta } from "./scanner/types";

const metaCache = new Map<string, { at: number; repos: RepoMeta[] }>();

/** A user's repo list, cached for ten minutes so a full scan makes one list call, not fifty. */
export async function reposFor(username: string, token?: string): Promise<RepoMeta[]> {
  const key = username.toLowerCase();
  let entry = metaCache.get(key);
  if (!entry || Date.now() - entry.at > 10 * 60 * 1000) {
    entry = { at: Date.now(), repos: await listRepos(username, token) };
    metaCache.set(key, entry);
  }
  return entry.repos;
}

export async function findMeta(username: string, repo: string, token?: string): Promise<RepoMeta | undefined> {
  return (await reposFor(username, token)).find((r) => r.name.toLowerCase() === repo.toLowerCase());
}

/** The repos RepoGuard scans: everything the user owns except forks of other people's projects. */
export function scannable(repos: RepoMeta[]): RepoMeta[] {
  return repos.filter((r) => !r.fork);
}
