"use client";

import { useMemo, useState } from "react";
import type { Finding, RecruiterView } from "@/lib/scanner/types";
import type { Mark } from "./ProfileScan";
import { SeverityTag, plural } from "./bits";
import { Mascot } from "./Mascot";

type Filter = "all" | "secret" | "personal";

function where(f: Finding) {
  const loc = `${f.repo}/${f.path}${f.line ? `:${f.line}` : ""}`;
  return f.alsoIn?.length ? `${loc} and ${plural(f.alsoIn.length, "other repo")}` : loc;
}

function status(f: Finding, mark?: Mark) {
  if (mark === "fixed") return { text: "Marked fixed, still there", strong: true };
  if (f.liveness === "history") return { text: `Only in history (${f.commit})`, strong: false };
  if (f.category === "personal" && f.note?.startsWith("These look made up")) return { text: "Look made up?", strong: false };
  return { text: "Still live", strong: true };
}

export function OwnerReport({
  username,
  repoCount,
  findings,
  recruiter,
  marks,
  failed,
  historyProgress,
  onOpen,
  onRecruiter,
  onRescan,
}: {
  username: string;
  repoCount: number;
  findings: Finding[];
  recruiter: RecruiterView | null;
  marks: Record<string, Mark>;
  failed: string[];
  historyProgress: { done: number; total: number };
  onOpen: (id: string) => void;
  onRecruiter: () => void;
  onRescan: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [hideMarked, setHideMarked] = useState(false);

  const visible = useMemo(
    () => findings.filter((f) => (filter === "all" || f.category === filter) && !(hideMarked && marks[f.id] === "not-real")),
    [findings, filter, hideMarked, marks],
  );
  const secrets = findings.filter((f) => f.category === "secret").length;
  const personal = findings.filter((f) => f.category === "personal").length;
  const critical = findings.filter((f) => f.severity === "critical" && f.liveness === "live").length;
  const fixedIds = Object.entries(marks).filter(([, m]) => m === "fixed").map(([id]) => id);
  const nowFixed = fixedIds.filter((id) => !findings.some((f) => f.id === id)).length;
  const historyRunning = historyProgress.total > 0 && historyProgress.done < historyProgress.total;

  let lead = "Nothing leaking in your code. Check the recruiter view for quick wins.";
  if (critical) lead = `Start with the ${critical === 1 ? "critical one: it's a live password or key" : `${critical} critical ones: they're live passwords or keys`}.`;
  else if (findings.length) lead = "Nothing critical. Work down the list when you have a moment.";

  return (
    <main className="page stack">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ maxWidth: 720 }}>
          <p style={{ margin: "0 0 8px", display: "flex", gap: 10, alignItems: "center", fontWeight: 600 }}>
            <span className="tag tag-good">Verified owner</span>
            {username}
          </p>
          <h1 className="display h1">Your report</h1>
          <p className="muted" style={{ margin: "10px 0 0" }}>
            {plural(repoCount, "repo")} sniffed just now. {lead}
          </p>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => window.print()}>
            Download PDF
          </button>
          <button className="btn btn-primary" onClick={onRescan}>
            Scan again
          </button>
        </div>
      </div>

      {historyRunning && (
        <p className="notice" aria-live="polite">
          Still reading old commits: {historyProgress.done} of {historyProgress.total} repos. Anything found there will appear below as &ldquo;only in history&rdquo;.
        </p>
      )}
      {nowFixed > 0 && <p className="notice" style={{ background: "var(--mint)" }}>{plural(nowFixed, "finding")} you marked fixed didn&apos;t turn up this time. Well done.</p>}
      {failed.length > 0 && <p className="notice">Couldn&apos;t read {failed.join(", ")}. Scan again to retry.</p>}

      <nav className="filters no-print" aria-label="Filter findings">
        <button className="filter" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          Everything {findings.length}
        </button>
        <button className="filter" aria-pressed={filter === "secret"} onClick={() => setFilter("secret")}>
          Secrets {secrets}
        </button>
        <button className="filter" aria-pressed={filter === "personal"} onClick={() => setFilter("personal")}>
          Personal data {personal}
        </button>
        <button className="filter" onClick={onRecruiter} disabled={!recruiter}>
          Recruiter view {recruiter ? recruiter.score : "…"}
        </button>
      </nav>

      {visible.length === 0 ? (
        <div className="card card-lg" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <Mascot mood="happy" size={110} />
          <p style={{ margin: 0, flex: "1 1 260px" }}>{findings.length ? "Nothing in this filter." : "No passwords, keys or personal data in your current code."}</p>
        </div>
      ) : (
        <ul className="rows">
          {visible.map((f) => {
            const s = status(f, marks[f.id]);
            return (
              <li key={f.id}>
                <button
                  className="card row"
                  onClick={() => onOpen(f.id)}
                  style={{ boxShadow: f.severity === "critical" ? "4px 4px 0 var(--ink)" : undefined, opacity: marks[f.id] === "not-real" ? 0.6 : 1 }}
                >
                  <SeverityTag severity={f.severity} />
                  <span className="row-title">{f.title}</span>
                  <span className="row-path">{where(f)}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: s.strong ? "var(--ink)" : "var(--muted)" }}>{marks[f.id] === "not-real" ? "Marked not real" : s.text}</span>
                </button>
              </li>
            );
          })}
          {recruiter && recruiter.deductions.length > 0 && (
            <li>
              <button className="row" onClick={onRecruiter} style={{ border: "2px dashed var(--line)", borderRadius: "var(--radius)", background: "transparent" }}>
                <SeverityTag severity="tidy" />
                <span className="row-title">{recruiter.deductions.slice(0, 2).map((d) => d.title).join(", ")}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>See recruiter view</span>
              </button>
            </li>
          )}
        </ul>
      )}

      <label className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 44 }}>
        <input type="checkbox" checked={hideMarked} onChange={(e) => setHideMarked(e.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--ink)" }} />
        Hide findings I&apos;ve marked not a real secret
      </label>
    </main>
  );
}
