import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Mascot } from "@/components/Mascot";

export const metadata: Metadata = {
  title: "What RepoGuard checks",
  description: "Every check RepoGuard runs on a GitHub profile: secrets other scanners miss, old commits, personal data in test files, and what recruiters see.",
};

const SECRETS = [
  { sev: "critical", title: "Passwords in seed scripts and config", body: "Seed users, test logins and config files with a real password typed in.", example: "password: 'gar••••••••'" },
  { sev: "critical", title: "Email app passwords", body: "Gmail and SMTP passwords in shell scripts. They skip two-step sign-in.", example: "MAIL_PASSWORD='abc••••••••'" },
  { sev: "high", title: "Database URLs with the password inside", body: "Postgres, MySQL, MongoDB and Redis connection strings.", example: "postgresql://rose:s3c••••••••@db" },
  { sev: "high", title: "Committed .env files", body: "Flagged even if the values look harmless. Example files like .env.example are fine." },
  {
    sev: "high",
    title: "API keys and framework secret keys",
    body: "Including Django's SECRET_KEY. The same key pasted into several repos shows up once, so one change fixes all of them.",
    example: "SECRET_KEY = 'dja••••••••'",
  },
  { sev: "critical", title: "Provider tokens and private keys", body: "AWS, GitHub, Stripe and Slack tokens, and private key files. GitHub may have caught these too; RepoGuard shows them alongside everything else." },
] as const;

const PERSONAL = [
  { title: "Kenyan phone numbers", body: "07xx, 01xx and +254, anywhere in the code." },
  { title: "KRA PINs", body: "Anywhere in the code." },
  { title: "National ID numbers", body: "When they're labelled as IDs, so ordinary numbers aren't flagged." },
  { title: "Emails and international numbers", body: "In seed, fixture, test, CSV and SQL files." },
];

const RECRUITER = [
  { points: 12, colour: "var(--tomato)", title: "Dead demo links.", body: "Heroku, Netlify, GitHub Pages and other hosts, checked live." },
  { points: 10, colour: "var(--tomato)", title: "Missing or starter READMEs.", body: "Untouched Angular, Rails and Next.js boilerplate counts." },
  { points: 8, colour: "var(--orange)", title: "Near-copy repos.", body: "A shared README template doesn't count as copying." },
  { points: 7, colour: "var(--orange)", title: "Committed node_modules or virtualenvs.", body: "" },
  { points: 5, colour: "var(--sun)", title: "Repos with no description.", body: "" },
];

const SEV_LABEL = { critical: "Critical", high: "High" } as const;

function Icon({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <span className="check-icon" style={{ background: bg }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </span>
  );
}

function TopicIntro({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="topic-intro">
      {icon}
      <h2 className="h2" style={{ margin: "16px 0 8px", fontSize: 32, lineHeight: 1.05 }}>
        {title}
      </h2>
      <p className="muted" style={{ margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

export default function ChecksPage() {
  return (
    <div className="wrap">
      <Header current="checks" />
      <main className="page" style={{ display: "flex", flexDirection: "column", gap: 56, paddingTop: 24, paddingBottom: 72 }}>
        <section style={{ display: "flex", flexWrap: "wrap", gap: 40, alignItems: "center" }}>
          <div style={{ flex: "1 1 520px" }}>
            <h1 className="display" style={{ fontSize: "clamp(42px, 6vw, 62px)" }}>
              What RepoGuard checks
            </h1>
            <p className="muted" style={{ margin: "18px 0 0", maxWidth: "34em", fontSize: 19 }}>
              Four kinds of problem, in every public repo you own. Here&apos;s exactly what it looks for, how serious each one is, and what it never touches.
            </p>
          </div>
          <Mascot size={150} className="hide-mobile" />
        </section>

        <section className="topic" aria-label="Secrets other scanners miss">
          <TopicIntro
            title="Secrets other scanners miss"
            icon={
              <Icon bg="var(--tomato)">
                <circle cx="8" cy="15" r="4" />
                <path d="M11 12l9-9M17 6l3 3M15 8l2 2" />
              </Icon>
            }
          >
            GitHub already looks for tokens with a known shape, like AWS or Stripe keys. These are the leaks that don&apos;t have one, which is why they slip through.
          </TopicIntro>
          <ul className="check-list topic-body">
            {SECRETS.map((c) => (
              <li key={c.title}>
                <span className={`tag tag-${c.sev}`}>{SEV_LABEL[c.sev]}</span>
                <div style={{ flex: "1 1 300px" }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>{c.title}</p>
                  <p className="muted small" style={{ margin: "2px 0 0" }}>
                    {c.body}
                  </p>
                </div>
                {"example" in c && <code className="example">{c.example}</code>}
              </li>
            ))}
          </ul>
        </section>

        <section className="topic" aria-label="Old commits">
          <TopicIntro
            title="Old commits"
            icon={
              <Icon bg="#c9b8ff">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
                <path d="M12 7v5l3 2" />
              </Icon>
            }
          >
            Deleting a password from your code doesn&apos;t delete it from git. Anyone can still open the old commit.
          </TopicIntro>
          <div className="topic-body card card-lg" style={{ gap: 14 }}>
            <p style={{ margin: 0 }}>When you sign in, RepoGuard reads the recent history of each repo (up to 150 commits) and runs the same checks on every line that was ever added.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "14px 16px", background: "var(--soft)", border: "2px dashed var(--line)", borderRadius: 14 }}>
              <span className="tag tag-high" style={{ fontSize: 13, padding: "1px 10px" }}>
                High
              </span>
              <span style={{ fontWeight: 700 }}>Secret key</span>
              <span className="mono muted small">settings.py</span>
              <span className="muted small" style={{ marginLeft: "auto", fontWeight: 600 }}>
                Only in history (3ac87c4)
              </span>
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              History is only scanned for the signed-in owner, using their own GitHub sign-in.
            </p>
          </div>
        </section>

        <section className="topic" aria-label="Other people's data">
          <TopicIntro
            title="Other people's data"
            icon={
              <Icon bg="var(--sun)">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" />
              </Icon>
            }
          >
            Real people&apos;s details in a public repo are a disclosure, even in a test file.
          </TopicIntro>
          <div className="topic-body">
            <div className="grid-2">
              {PERSONAL.map((p) => (
                <div key={p.title} className="card" style={{ padding: "16px 18px" }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>{p.title}</p>
                  <p className="muted small" style={{ margin: "2px 0 0" }}>
                    {p.body}
                  </p>
                </div>
              ))}
            </div>
            <p className="dashed" style={{ margin: 0, background: "var(--card)", fontSize: 16, padding: "16px 18px" }}>
              RepoGuard spots obviously made-up test data (example.com emails, numbers like 123 4567) and says so. For anything real, it explains what the Kenya Data Protection Act and GDPR expect, including when a breach has to be reported to
              the ODPC.
            </p>
          </div>
        </section>

        <section className="topic" aria-label="What recruiters see">
          <TopicIntro
            title="What recruiters see"
            icon={
              <Icon bg="var(--mint)">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </Icon>
            }
          >
            A score out of 100 for the first 30 seconds on your profile. Nothing here needs new code.
          </TopicIntro>
          <div className="topic-body" style={{ gap: 10 }}>
            {RECRUITER.map((r) => (
              <div key={r.title} className="card deduction">
                <span className="points" style={{ background: r.colour }}>
                  up to −{r.points}
                </span>
                <span>
                  <strong>{r.title}</strong> {r.body && <span className="muted">{r.body}</span>}
                </span>
              </div>
            ))}
            <p className="muted small" style={{ margin: "4px 0 0" }}>
              Plus a list of old repos worth archiving, and a nudge if your profile README still has GitHub&apos;s starter text.
            </p>
          </div>
        </section>

        <section className="dark-card" style={{ padding: "30px 32px", display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center" }} aria-label="What it never does">
          <h2 className="h2" style={{ flex: "0 0 240px", fontSize: 30, lineHeight: 1.05 }}>
            What it never does
          </h2>
          <ul className="grid-2" style={{ flex: "1 1 560px", margin: 0, padding: 0, listStyle: "none", gap: "12px 28px", fontSize: 16 }}>
            <li>
              <strong>Read private repos.</strong> <span style={{ color: "#d9d2ee" }}>Sign-in asks for your public profile only.</span>
            </li>
            <li>
              <strong>Change anything.</strong> <span style={{ color: "#d9d2ee" }}>No write access to your account or repos.</span>
            </li>
            <li>
              <strong>Keep your code.</strong> <span style={{ color: "#d9d2ee" }}>Repos are read in memory and thrown away.</span>
            </li>
            <li>
              <strong>Show your details to others.</strong> <span style={{ color: "#d9d2ee" }}>Visitors only ever see counts.</span>
            </li>
          </ul>
        </section>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <Link href="/" className="btn btn-primary" style={{ minHeight: 56, padding: "0 28px", fontSize: 17 }}>
            Scan a profile
          </Link>
          <span className="muted">It takes about a minute for 40 repos.</span>
        </div>
      </main>
    </div>
  );
}
