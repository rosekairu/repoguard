import { Header } from "@/components/Header";
import { Mascot } from "@/components/Mascot";
import { ScanForm } from "@/components/ScanForm";

export default function Home() {
  return (
    <div className="wrap" style={{ overflow: "hidden" }}>
      <Header />
      <main className="page" style={{ paddingTop: 8 }}>
        <section className="hero">
          <div className="hero-copy">
            <h1 className="display hero-title">Let&apos;s see what your GitHub is oversharing.</h1>
            <p className="muted" style={{ margin: 0, maxWidth: "30em", fontSize: 19 }}>
              Old passwords, phone numbers in test data, keys hiding in 2020 commits. We find them, you fix them, and nobody else sees the details.
            </p>
            <ScanForm />
          </div>

          <div className="hero-art" aria-label="Example findings">
            <Mascot className="mascot-hero drop-in" style={{ position: "absolute", right: 10, top: 0, animationDelay: "380ms" }} />
            <div className="sticker drop-in" style={{ left: 0, top: 70, width: 330, transform: "rotate(-3deg)", ["--r" as string]: "-3deg" }}>
              <span className="tag tag-critical">Critical</span>
              <p className="sticker-title">Passwords in a seed script</p>
              <p className="muted small">seed_users.js, line 7</p>
            </div>
            <div className="sticker drop-in" style={{ left: 150, top: 225, width: 320, transform: "rotate(2.5deg)", ["--r" as string]: "2.5deg", animationDelay: "120ms" }}>
              <span className="tag tag-personal">Personal data</span>
              <p className="sticker-title">13 phone numbers in test data</p>
              <p className="muted small">seed.js</p>
            </div>
            <div
              className="sticker dark-card drop-in"
              style={{ left: 30, top: 395, width: 300, transform: "rotate(-1.5deg)", ["--r" as string]: "-1.5deg", boxShadow: "6px 6px 0 var(--tomato)", animationDelay: "240ms" }}
            >
              <p className="display" style={{ fontSize: 40 }}>
                58<span style={{ fontSize: 20, fontWeight: 600, letterSpacing: 0 }}>/100</span>
              </p>
              <p className="small" style={{ marginTop: 4, color: "#d9d2ee" }}>
                What a recruiter sees. Five quick fixes get you to 100.
              </p>
            </div>
          </div>
        </section>

        <section id="checks" className="checks" aria-label="What RepoGuard checks">
          <div className="card card-lg">
            <span className="check-icon" style={{ background: "var(--tomato)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="8" cy="15" r="4" />
                <path d="M11 12l9-9M17 6l3 3M15 8l2 2" />
              </svg>
            </span>
            <h2 className="h2" style={{ margin: "16px 0 8px", fontSize: 25 }}>
              Secrets other scanners miss
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: 16 }}>
              Seed passwords, connection strings, committed .env files, and the same key pasted into four repos. GitHub&apos;s own scanner looks for provider tokens; these slip past it.
            </p>
          </div>
          <div className="card card-lg">
            <span className="check-icon" style={{ background: "var(--sun)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" />
              </svg>
            </span>
            <h2 className="h2" style={{ margin: "16px 0 8px", fontSize: 25 }}>
              Other people&apos;s data
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: 16 }}>
              Phone numbers, ID numbers, KRA PINs and emails in test files, with what the Kenya Data Protection Act and GDPR expect you to do about them.
            </p>
          </div>
          <div className="card card-lg">
            <span className="check-icon" style={{ background: "var(--mint)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <h2 className="h2" style={{ margin: "16px 0 8px", fontSize: 25 }}>
              What recruiters see
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: 16 }}>
              Dead demo links, committed node_modules, empty READMEs and copy-paste repos, scored out of 100.
            </p>
          </div>
        </section>

        <section id="next" className="roadmap dark-card" aria-label="Coming in version 2">
          <h2 className="h2" style={{ flex: "0 0 200px", lineHeight: 1.05 }}>
            Coming in version 2
          </h2>
          <ul>
            <li>Fix-it pull requests</li>
            <li>Weekly rescans by email</li>
            <li>A &ldquo;clean profile&rdquo; README badge</li>
            <li>Bootcamp mode for whole cohorts</li>
          </ul>
        </section>

        <p className="muted small" style={{ marginTop: 40 }}>
          RepoGuard only reads public repositories. Signing in asks GitHub for your public profile and nothing else: no private repos, no write access. Code is read in memory and never stored.
          Built by <a href="https://rosekairu.com">Rose Kairu</a>.
        </p>
      </main>
    </div>
  );
}
