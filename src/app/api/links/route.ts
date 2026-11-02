import { NextResponse, type NextRequest } from "next/server";
import { DEMO_HOSTS, isDeadLink } from "@/lib/github";
import { rateLimited } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Check which demo links are dead. Only known hosting platforms are checked
 * (Heroku, GitHub Pages, Netlify, Vercel…), so this can't be used to make requests to arbitrary sites.
 */
export async function POST(req: NextRequest) {
  if (rateLimited(req, "links", 30)) return NextResponse.json({ dead: [] }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { urls?: unknown } | null;
  const urls = Array.isArray(body?.urls) ? body.urls.filter((u): u is string => typeof u === "string").slice(0, 40) : [];
  const allowed = [...new Set(urls.map((u) => u.trim()))].filter((u) => DEMO_HOSTS.test(u.replace(/^http:\/\//i, "https://")));

  const dead: string[] = [];
  const queue = [...allowed];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const u = queue.shift()!;
        if (await isDeadLink(u)) dead.push(u);
      }
    }),
  );
  return NextResponse.json({ dead });
}
