"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildRecruiterView, mergeFindings } from "@/lib/scanner/profile";
import type { Finding, HygieneFacts, PublicFinding, RepoMeta } from "@/lib/scanner/types";
import { FindingDetail } from "./FindingDetail";
import { OwnerReport } from "./OwnerReport";
import { PublicSummary } from "./PublicSummary";
import { RecruiterPanel } from "./RecruiterPanel";
import { ScanProgress } from "./ScanProgress";

interface ProfileResponse {
  user: { login: string; name: string | null; avatarUrl: string; publicRepos: number };
  repos: RepoMeta[];
  isOwner: boolean;
  profileReadmeIsStarter: boolean;
}

export type Mark = "fixed" | "not-real";

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

/** Run tasks with a fixed number in flight, so a 50-repo profile doesn't fire 50 requests at once. */
async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift()!);
  }));
}

function useMarks(username: string) {
  const key = `repoguard:marks:${username.toLowerCase()}`;
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  useEffect(() => {
    try {
      setMarks(JSON.parse(localStorage.getItem(key) ?? "{}"));
    } catch {
      setMarks({});
    }
  }, [key]);
  const setMark = useCallback(
    (id: string, mark: Mark | null) => {
      setMarks((prev) => {
        const next = { ...prev };
        if (mark) next[id] = mark;
        else delete next[id];
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* private mode: marks just won't persist */
        }
        return next;
      });
    },
    [key],
  );
  return { marks, setMark };
}

export function ProfileScan({ username, viewer, signInAction }: { username: string; viewer: string | null; signInAction: () => Promise<void> }) {
  const router = useRouter();
  const params = useSearchParams();
  const view = params.get("view");
  const findingId = params.get("finding");

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [live, setLive] = useState<Finding[]>([]);
  const [hygiene, setHygiene] = useState<HygieneFacts[]>([]);
  const [publicFindings, setPublicFindings] = useState<PublicFinding[] | null>(null);
  const [dead, setDead] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Finding[]>([]);
  const [historyDone, setHistoryDone] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [finished, setFinished] = useState(false);
  const [runId, setRunId] = useState(0);
  const [fresh, setFresh] = useState(false);
  const started = useRef<number | null>(null);
  const { marks, setMark } = useMarks(username);

  useEffect(() => {
    if (started.current === runId) return;
    started.current = runId;
    let cancelled = false;

    (async () => {
      setError(null);
      setDone(0);
      setFailed([]);
      setLive([]);
      setHygiene([]);
      setHistory([]);
      setHistoryDone(0);
      setPublicFindings(null);
      setFinished(false);

      let p: ProfileResponse;
      try {
        p = await getJSON<ProfileResponse>(`/api/profile/${username}`);
      } catch (e) {
        setError((e as Error).message);
        return;
      }
      if (cancelled) return;
      setProfile(p);

      const repos = p.repos.filter((r) => !r.fork);
      setTotal(repos.length);
      const sealed: string[] = [];
      const allHygiene: HygieneFacts[] = [];
      const allLive: Finding[] = [];
      const bad: string[] = [];

      await pool(repos, 4, async (r) => {
        try {
          const res = await getJSON<{ findings?: Finding[]; sealed?: string; hygiene: HygieneFacts }>(
            `/api/scan/${username}/${encodeURIComponent(r.name)}${fresh ? "?fresh=1" : ""}`,
          );
          allHygiene.push(res.hygiene);
          if (res.findings) allLive.push(...res.findings);
          if (res.sealed) sealed.push(res.sealed);
        } catch {
          bad.push(r.name);
        }
        if (!cancelled) setDone((n) => n + 1);
      });
      if (cancelled) return;
      setHygiene(allHygiene);
      setLive(allLive);
      setFailed(bad);

      // Dead demo links: public info, checked once per scan
      const links = [...new Set([...allHygiene.flatMap((h) => h.demoLinks), ...repos.map((r) => r.homepage).filter((h): h is string => Boolean(h))])];
      if (links.length) {
        getJSON<{ dead: string[] }>("/api/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls: links }) })
          .then((r) => !cancelled && setDead(new Set(r.dead)))
          .catch(() => {});
      }

      if (!p.isOwner) {
        if (bad.length) {
          setError(`Couldn't read ${bad.length} repo${bad.length > 1 ? "s" : ""}, so the summary isn't complete. Try again in a few minutes.`);
          return;
        }
        try {
          const s = await getJSON<{ findings: PublicFinding[] }>(`/api/summary/${username}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sealed }) });
          if (!cancelled) setPublicFindings(s.findings);
        } catch (e) {
          setError((e as Error).message);
        }
        setFinished(true);
        return;
      }

      setFinished(true);
      // Owner only: read old commits in the background while the report is already on screen
      const withHistory = repos.filter((r) => r.sizeKb > 0);
      setHistoryTotal(withHistory.length);
      await pool(withHistory, 3, async (r) => {
        try {
          const res = await getJSON<{ findings: Finding[] }>(`/api/history/${username}/${encodeURIComponent(r.name)}`);
          if (!cancelled && res.findings.length) setHistory((h) => [...h, ...res.findings]);
        } catch {
          /* history is a bonus; a failed repo just isn't covered */
        }
        if (!cancelled) setHistoryDone((n) => n + 1);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [username, runId, fresh]);

  const findings = useMemo(() => {
    const liveKeys = new Set(live.map((f) => f.reuseKey).filter(Boolean));
    const liveIds = new Set(live.map((f) => f.id));
    const onlyHistory = history.filter((h) => !liveIds.has(h.id) && !(h.reuseKey && liveKeys.has(h.reuseKey)));
    return mergeFindings([...live, ...onlyHistory]);
  }, [live, history]);

  const recruiter = useMemo(() => {
    if (!profile || !finished) return null;
    return buildRecruiterView(username, profile.repos, hygiene, dead, profile.profileReadmeIsStarter ? "Here are some ideas to get you started" : null);
  }, [profile, finished, hygiene, dead, username]);

  const go = useCallback((q: string) => router.push(`/u/${username}${q}`, { scroll: true }), [router, username]);

  const rescan = useCallback(() => {
    setFresh(true);
    setRunId((n) => n + 1);
    go("");
  }, [go]);

  if (error && !finished) {
    return (
      <main className="page">
        <div className="card card-lg" style={{ maxWidth: 640 }}>
          <h1 className="h2">That didn&apos;t work</h1>
          <p className="muted">{error}</p>
          <button className="btn btn-primary" onClick={() => setRunId((n) => n + 1)}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!finished || !profile) {
    return <ScanProgress username={profile?.user.login ?? username} done={done} total={total} />;
  }

  if (!profile.isOwner) {
    return (
      <PublicSummary
        username={profile.user.login}
        repoCount={total}
        findings={publicFindings}
        score={recruiter?.score ?? null}
        error={error}
        viewer={viewer}
        signInAction={signInAction}
      />
    );
  }

  const selected = findingId ? findings.find((f) => f.id === findingId) : undefined;
  if (selected) {
    return <FindingDetail username={profile.user.login} finding={selected} index={findings.indexOf(selected)} total={findings.length} mark={marks[selected.id]} setMark={setMark} onBack={() => go("")} />;
  }

  if (view === "recruiter" && recruiter) {
    return <RecruiterPanel view={recruiter} username={profile.user.login} onBack={() => go("")} />;
  }

  return (
    <OwnerReport
      username={profile.user.login}
      repoCount={total}
      findings={findings}
      recruiter={recruiter}
      marks={marks}
      failed={failed}
      historyProgress={{ done: historyDone, total: historyTotal }}
      onOpen={(id) => go(`?finding=${id}`)}
      onRecruiter={() => go("?view=recruiter")}
      onRescan={rescan}
    />
  );
}
