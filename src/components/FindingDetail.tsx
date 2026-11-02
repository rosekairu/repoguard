"use client";

import { fixStepsFor, whyItMatters } from "@/lib/fixes";
import type { Finding } from "@/lib/scanner/types";
import type { Mark } from "./ProfileScan";
import { BackButton, SeverityTag, plural } from "./bits";

export function FindingDetail({
  username,
  finding: f,
  index,
  total,
  mark,
  setMark,
  onBack,
}: {
  username: string;
  finding: Finding;
  index: number;
  total: number;
  mark?: Mark;
  setMark: (id: string, mark: Mark | null) => void;
  onBack: () => void;
}) {
  const steps = fixStepsFor(f);
  const href =
    f.liveness === "history" && f.commit
      ? `https://github.com/${username}/${f.repo}/commit/${f.commit}`
      : `https://github.com/${username}/${f.repo}/blob/HEAD/${f.path}${f.line ? `#L${f.line}` : ""}`;

  return (
    <main className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <BackButton onClick={onBack} />
        <span className="muted small">
          Finding {index + 1} of {total}
        </span>
      </div>
      <div className="split">
        <article className="split-main">
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <SeverityTag severity={f.severity} />
              <span className="tag">{f.liveness === "history" ? `Only in history, commit ${f.commit}` : "Still live in the current code"}</span>
            </div>
            <h1 className="display" style={{ fontSize: 52, lineHeight: 1.02 }}>
              {f.title}
            </h1>
            <p className="muted" style={{ margin: "14px 0 0" }}>
              {whyItMatters(f)}
            </p>
            {f.alsoIn?.length ? (
              <p style={{ margin: "10px 0 0", fontWeight: 600 }}>
                The same value is also in {f.alsoIn.join(", ")}. One change fixes {plural(f.alsoIn.length + 1, "repo")}.
              </p>
            ) : null}
          </div>

          {f.context && f.context.length > 0 ? (
            <figure className="code">
              <figcaption style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span>
                  {f.repo}/{f.path}
                </span>
                <a href={href} target="_blank" rel="noreferrer" style={{ color: "#d9d2ee" }}>
                  Open on GitHub
                </a>
              </figcaption>
              <pre>
                {f.context.map((l) => (
                  <span key={l.line + l.text} className={`ln${l.hit ? " hit" : ""}`}>
                    <span>{l.line || "+"}</span>
                    {l.text}
                  </span>
                ))}
              </pre>
            </figure>
          ) : (
            <p className="card" style={{ margin: 0, padding: "14px 18px", fontFamily: "var(--mono)", fontSize: 15 }}>
              {f.repo}/{f.path}
              {f.count ? ` (${plural(f.count, "item")})` : ""}
            </p>
          )}

          <section className="card card-lg">
            <h2 className="h2" style={{ marginBottom: 16 }}>
              Fix it in this order
            </h2>
            <ol className="steps">
              {steps.map((s, i) => (
                <li key={s.title}>
                  <span className="step-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>{s.title}</p>
                    <p className="muted" style={{ margin: "2px 0 0", fontSize: 16 }}>
                      {s.body}
                    </p>
                    {s.code && <pre className="cmd">{s.code}</pre>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </article>

        <aside className="split-side no-print">
          <div className="card card-lg raised" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 className="h3" style={{ fontWeight: 800 }}>
              Done with this one?
            </h2>
            {mark ? (
              <>
                <p className="muted" style={{ margin: 0, fontSize: 16 }}>
                  {mark === "fixed" ? "You marked this fixed. If it still turns up on the next scan, it'll say so." : "You marked this as not a real secret."}
                </p>
                <button className="btn" onClick={() => setMark(f.id, null)}>
                  Undo
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-mint" onClick={() => setMark(f.id, "fixed")}>
                  Mark fixed, check next scan
                </button>
                <button className="btn" onClick={() => setMark(f.id, "not-real")}>
                  {f.category === "personal" ? "These aren't real people" : "This isn't a real secret"}
                </button>
              </>
            )}
            <p className="muted small" style={{ margin: 0 }}>
              Saved in this browser only.
            </p>
          </div>
          <div className="dashed">
            <span className="tag tag-dark">Version 2</span>
            <p className="muted" style={{ margin: "10px 0 0", fontSize: 16 }}>
              RepoGuard will do the clean-up steps for you and open a pull request you review and merge.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
