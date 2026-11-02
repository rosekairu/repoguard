"use client";

import { useState } from "react";
import type { PublicFinding, Severity } from "@/lib/scanner/types";
import { Lock, SeverityTag, plural } from "./bits";
import { Mascot } from "./Mascot";

const COUNT_LABEL: Record<Severity, (n: number) => string> = {
  critical: (n) => `${n} critical`,
  high: (n) => `${n} high`,
  personal: (n) => `${n} personal data`,
  tidy: (n) => `${n} tidy-up`,
};

export function PublicSummary({
  username,
  repoCount,
  findings,
  score,
  error,
  viewer,
  signInAction,
}: {
  username: string;
  repoCount: number;
  findings: PublicFinding[] | null;
  score: number | null;
  error: string | null;
  viewer: string | null;
  signInAction: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const list = findings ?? [];
  const counts = (["critical", "high", "personal"] as Severity[]).map((s) => [s, list.filter((f) => f.severity === s).length] as const).filter(([, n]) => n > 0);
  const shown = list.slice(0, 3);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked: the URL is in the address bar anyway */
    }
  }

  return (
    <main className="page">
      <div className="split">
        <section className="split-main">
          <div>
            <p className="muted" style={{ margin: "0 0 6px", fontWeight: 600 }}>
              github.com/{username}, {plural(repoCount, "public repo")}
              {score !== null && `, recruiter score ${score}/100`}
            </p>
            <h1 className="display h1">{list.length ? `${plural(list.length, "thing")} worth fixing` : error ? "Summary unavailable" : "Nothing leaking. Nice."}</h1>
          </div>
          {error && <p className="notice">{error}</p>}
          {counts.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {counts.map(([s, n]) => (
                <span key={s} className={`tag tag-${s}`} style={{ padding: "8px 16px", fontSize: 16 }}>
                  {COUNT_LABEL[s](n)}
                </span>
              ))}
            </div>
          )}
          {shown.length > 0 && (
            <ul className="rows" aria-label="Findings, details hidden">
              {shown.map((f, i) => (
                <li key={i} className="card row">
                  <SeverityTag severity={f.severity} />
                  <span className="row-title" style={{ fontWeight: 600 }}>
                    {f.label}
                  </span>
                  <span className="muted small" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <Lock />
                    Where: owner only
                  </span>
                </li>
              ))}
              {list.length > shown.length && (
                <li className="muted" style={{ padding: "6px 20px", fontWeight: 600 }}>
                  and {list.length - shown.length} more
                </li>
              )}
            </ul>
          )}
          {!list.length && !error && (
            <div className="card card-lg" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <Mascot mood="happy" size={110} />
              <p style={{ margin: 0, flex: "1 1 260px" }}>No passwords, keys or personal data turned up in {plural(repoCount, "repo")}. The owner can sign in to check old commits too.</p>
            </div>
          )}
        </section>

        <aside className="split-side">
          <div className="card card-lg raised" style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
            <Mascot mood="eyes-covered" size={96} />
            <h2 className="h2">Is this your profile?</h2>
            {viewer && viewer.toLowerCase() !== username.toLowerCase() ? (
              <p className="muted" style={{ margin: 0, fontSize: 16 }}>
                You&apos;re signed in as {viewer}. Only {username} can see the details of this report.{" "}
                <a href={`/u/${viewer}`}>See your own report</a>.
              </p>
            ) : (
              <>
                <p className="muted" style={{ margin: 0, fontSize: 16 }}>
                  Sign in with the matching GitHub account to see every file, line and fix. Nobody else can.
                </p>
                <form action={signInAction}>
                  <button className="btn btn-primary">Sign in and see details</button>
                </form>
              </>
            )}
          </div>
          <div className="dashed">
            <h2 className="h3" style={{ marginBottom: 6 }}>
              Know the owner?
            </h2>
            <p className="muted" style={{ margin: "0 0 14px", fontSize: 16 }}>
              Send them this page. It never shows the secrets, so it&apos;s safe to share.
            </p>
            <button className="btn" onClick={copy} aria-live="polite">
              {copied ? "Link copied" : "Copy link"}
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
