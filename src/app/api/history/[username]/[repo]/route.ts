import { NextResponse, type NextRequest } from "next/server";
import { GitHubError, REPONAME, USERNAME, listCommitPatches } from "@/lib/github";
import { scanCommitPatches } from "@/lib/scanner/scanRepo";
import { getViewer, isOwner, withReuseKeys } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Old commits are only scanned for the signed-in owner, with their own token. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string; repo: string }> }) {
  const { username, repo } = await params;
  if (!USERNAME.test(username) || !REPONAME.test(repo)) return NextResponse.json({ error: "Invalid name" }, { status: 400 });

  const viewer = await getViewer(req);
  if (!isOwner(viewer, username) || !viewer.accessToken) {
    return NextResponse.json({ error: "Only the owner can scan history." }, { status: 403 });
  }

  try {
    const patches = await listCommitPatches(username, repo, viewer.accessToken);
    const { findings, valueHashes } = scanCommitPatches(repo, patches);
    return NextResponse.json({ repo, commits: patches.length, findings: withReuseKeys(findings, valueHashes) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    const status = e instanceof GitHubError ? e.status : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : "History scan failed" }, { status });
  }
}
