import { NextResponse, type NextRequest } from "next/server";
import { GitHubError, REPONAME, USERNAME, fetchRepoFiles } from "@/lib/github";
import { findMeta } from "@/lib/meta";
import { scanRepoFiles } from "@/lib/scanner/scanRepo";
import { cacheGet, cacheSet, getViewer, isOwner, rateLimited, seal, toPublic, tokenFor, withReuseKeys } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string; repo: string }> }) {
  const { username, repo } = await params;
  if (!USERNAME.test(username) || !REPONAME.test(repo)) return NextResponse.json({ error: "Invalid name" }, { status: 400 });

  const viewer = await getViewer(req);
  const owner = isOwner(viewer, username);
  if (rateLimited(req, owner ? "repo-owner" : "repo", owner ? 1000 : 400)) {
    return NextResponse.json({ error: "Too many scans this hour. Try again later." }, { status: 429 });
  }

  try {
    const token = tokenFor(viewer);
    const meta = await findMeta(username, repo, token);
    if (!meta) return NextResponse.json({ error: "Repo not found" }, { status: 404 });

    const key = `${username.toLowerCase()}/${meta.name}@${meta.pushedAt}`;
    const fresh = owner && req.nextUrl.searchParams.get("fresh") === "1";
    let result = fresh ? undefined : cacheGet(key);
    if (!result) {
      const { files, allPaths, skipped } = await fetchRepoFiles(username, meta, token);
      result = { ...scanRepoFiles(meta.name, files, allPaths), skipped };
      cacheSet(key, result);
    }

    // The README text is public anyway, but there's no need to send all of it.
    const hygiene = { ...result.hygiene, readmeText: result.hygiene.readmeText.slice(0, 6000) };
    return NextResponse.json(
      owner
        ? { repo: meta.name, owner: true, findings: withReuseKeys(result.findings, result.valueHashes), hygiene, skipped: result.skipped }
        : { repo: meta.name, owner: false, sealed: seal(username, meta.name, toPublic(result.findings, result.valueHashes)), hygiene, skipped: result.skipped },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    const status = e instanceof GitHubError ? e.status : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Scan failed" }, { status });
  }
}
