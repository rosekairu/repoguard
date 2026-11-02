import { NextResponse, type NextRequest } from "next/server";
import { USERNAME } from "@/lib/github";
import { reposFor, scannable } from "@/lib/meta";
import { tokenFor, unseal, getViewer } from "@/lib/server";
import type { PublicFinding, Severity } from "@/lib/scanner/types";

export const runtime = "nodejs";

const ORDER: Record<Severity, number> = { critical: 0, high: 1, personal: 2, tidy: 3 };

/**
 * Turn the sealed per-repo results into profile-wide counts. Requires every scannable repo,
 * so nobody can learn which single repo leaks by sending just one.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (!USERNAME.test(username)) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { sealed?: unknown } | null;
  const tokens = Array.isArray(body?.sealed) ? body.sealed.filter((t): t is string => typeof t === "string").slice(0, 600) : [];

  const seen = new Map<string, PublicFinding[]>();
  for (const t of tokens) {
    const p = unseal(t);
    if (p && p.u === username.toLowerCase()) seen.set(p.r.toLowerCase(), p.f);
  }

  const viewer = await getViewer(req);
  const required = scannable(await reposFor(username, tokenFor(viewer))).map((r) => r.name.toLowerCase());
  const missing = required.filter((r) => !seen.has(r));
  if (missing.length) return NextResponse.json({ error: "Scan every repo before asking for the summary." }, { status: 400 });

  // Count a value reused across several repos once, then drop the fingerprint before replying.
  const keys = new Set<string>();
  const unique = [...seen.values()].flat().filter((f) => {
    if (!f.k) return true;
    if (keys.has(f.k)) return false;
    keys.add(f.k);
    return true;
  });
  const findings = unique.map(({ severity, label }) => ({ severity, label })).sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.label.localeCompare(b.label));
  return NextResponse.json({ findings });
}
