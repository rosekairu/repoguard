import { NextResponse, type NextRequest } from "next/server";
import { GitHubError, USERNAME, getProfileReadme, getUser } from "@/lib/github";
import { reposFor } from "@/lib/meta";
import { getViewer, isOwner, rateLimited, tokenFor } from "@/lib/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (!USERNAME.test(username)) return NextResponse.json({ error: "That isn't a valid GitHub username." }, { status: 400 });

  const viewer = await getViewer(req);
  const owner = isOwner(viewer, username);
  if (!owner && rateLimited(req, "profile", 15)) {
    return NextResponse.json({ error: "You've scanned a lot of profiles this hour. Try again later, or sign in to scan your own." }, { status: 429 });
  }

  try {
    const token = tokenFor(viewer);
    const [user, repos, profileReadme] = await Promise.all([getUser(username, token), reposFor(username, token), getProfileReadme(username, token)]);
    return NextResponse.json({
      user,
      repos,
      isOwner: owner,
      viewer: viewer.login ?? null,
      profileReadmeIsStarter: Boolean(profileReadme && /Here are some ideas to get you started/i.test(profileReadme)),
    });
  } catch (e) {
    if (e instanceof GitHubError) {
      const msg = e.status === 404 ? `There's no GitHub account called ${username}.` : e.message;
      return NextResponse.json({ error: msg }, { status: e.status });
    }
    return NextResponse.json({ error: "Something went wrong talking to GitHub. Try again." }, { status: 502 });
  }
}
