"use client";

import type { RecruiterView } from "@/lib/scanner/types";
import { BackButton } from "./bits";
import { Mascot } from "./Mascot";

function pointsColour(p: number) {
  if (p >= 10) return "var(--tomato)";
  if (p >= 6) return "var(--orange)";
  return "var(--sun)";
}

export function RecruiterPanel({ view, username, onBack }: { view: RecruiterView; username: string; onBack: () => void }) {
  const perfect = view.deductions.length === 0;
  return (
    <main className="page">
      <div style={{ marginBottom: 20 }}>
        <BackButton onClick={onBack} />
      </div>
      <div className="split">
        <aside className="split-side" style={{ maxWidth: 400 }}>
          <div className="dark-card score-card">
            <p className="score">
              {view.score}
              <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: 0 }}>/100</span>
            </p>
            <p style={{ margin: "12px 0 0", color: "#d9d2ee" }}>What a recruiter sees in the first 30 seconds on your profile.</p>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {perfect ? "Your profile is in great shape." : "Every fix here takes minutes, and none of them needs new code."}
          </p>
        </aside>

        <div className="split-main" style={{ gap: 26 }}>
          <section aria-label="What's costing points">
            <h1 className="display" style={{ fontSize: 40, marginBottom: 14 }}>
              {perfect ? "Nothing costing you points" : "What's costing you points"}
            </h1>
            {perfect ? (
              <Mascot mood="happy" size={130} />
            ) : (
              <ul className="rows">
                {view.deductions.map((d) => (
                  <li key={d.id} className="card" style={{ display: "flex", gap: 18, alignItems: "center", padding: "14px 18px" }}>
                    <span className="points" style={{ background: pointsColour(d.points) }}>
                      −{d.points}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700 }}>{d.title}</p>
                      <p className="muted small" style={{ margin: 0 }}>
                        {d.detail}
                      </p>
                      <details style={{ marginTop: 4 }}>
                        <summary className="small" style={{ cursor: "pointer", fontWeight: 600 }}>
                          Which repos
                        </summary>
                        <p className="small mono" style={{ margin: "6px 0 0", overflowWrap: "anywhere" }}>
                          {d.repos.join(", ")}
                        </p>
                      </details>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {view.archiveSuggestions.length > 0 && (
            <section className="dashed">
              <h2 className="h2" style={{ fontSize: 26, marginBottom: 10 }}>
                {view.archiveSuggestions.length} repos you could archive
              </h2>
              <ul style={{ margin: "0 0 14px", padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 8 }}>
                {view.archiveSuggestions.map((r) => (
                  <li key={r}>
                    <a className="tag" href={`https://github.com/${username}/${r}/settings#danger-zone`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", fontWeight: 600 }}>
                      {r}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="muted small" style={{ margin: 0 }}>
                Each one opens that repo&apos;s settings on GitHub, where Archive is at the bottom. Archived repos stay public, become read-only and are labelled as finished. Nothing gets deleted.
              </p>
            </section>
          )}

          {view.profileReadmeIsStarter && (
            <p className="card" style={{ margin: 0, padding: "16px 18px" }}>
              Your profile README still has GitHub&apos;s starter text (&ldquo;Here are some ideas to get you started&rdquo;). Replace it with two lines about what you build, and pin your four best repos.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
