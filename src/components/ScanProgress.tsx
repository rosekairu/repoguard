import { Mascot } from "./Mascot";

export function ScanProgress({ username, done, total }: { username: string; done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 4;
  return (
    <main className="page" aria-busy="true">
      <div className="split" style={{ alignItems: "center" }}>
        <div className="split-main">
          <p className="muted" style={{ margin: 0, fontWeight: 600 }}>
            github.com/{username}
          </p>
          <h1 className="display h1">{total ? `Sniffing through ${total} repos…` : "Finding the repos…"}</h1>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={done} aria-label="Repos scanned">
            <div style={{ width: `${pct}%` }} />
          </div>
          <p className="muted" style={{ margin: 0 }} aria-live="polite">
            {total ? `${done} of ${total} checked. Each repo is downloaded, read in memory, then thrown away.` : "Asking GitHub for the list of public repos."}
          </p>
        </div>
        <div className="split-side" style={{ alignItems: "center" }}>
          <Mascot size={190} />
        </div>
      </div>
    </main>
  );
}
