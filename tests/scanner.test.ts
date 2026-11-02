// Every secret, phone number and PIN in this file is made up, for testing the detectors.
import { describe, expect, it } from "vitest";
import { scanLineForSecrets, isCommittedEnvFile } from "../src/lib/scanner/rules";
import { scanCommitPatches, scanPersonalData, scanRepoFiles, isPlaceholderReadme } from "../src/lib/scanner/scanRepo";
import { buildRecruiterView, findDuplicateGroups, mergeFindings } from "../src/lib/scanner/profile";
import { mask } from "../src/lib/scanner/util";
import type { HygieneFacts, RepoMeta } from "../src/lib/scanner/types";

describe("secret rules", () => {
  it.each([
    ["seed_users.js", "      { full_name: 'Admin', email: 'a@b.org', password: 'garden2026!', role: 'x' },", "password-assignment", "critical"],
    ["start.sh", "export MAIL_PASSWORD='abcdwxyzefghijkl'", "password-assignment", "critical"],
    [".env", "DATABASE_URL=postgresql://rose:s3cretPass@localhost:5432/app", "connection-string", "high"],
    ["config.py", "    NEWS_API_KEY='f3a91c0b7d2e4a6f8b1c3d5e7f9a0b2c'", "api-key-assignment", "high"],
    ["settings.py", "SECRET_KEY = 'django-insecure-x8#k2m!q9z@p4w7v1t6y3u0'", "api-key-assignment", "high"],
    // Built at runtime so this made-up key doesn't trip GitHub's push protection.
    ["deploy.yml", "aws_key: " + "AKIA" + "IOSFODNN7EXAMPLF", "aws-access-key", "critical"],
  ])("finds %s", (path, line, ruleId, severity) => {
    const hit = scanLineForSecrets(line, path);
    expect(hit?.ruleId).toBe(ruleId);
    expect(hit?.severity).toBe(severity);
  });

  it.each([
    ["app.py", "password = os.environ.get('DB_PASSWORD')"],
    ["app.js", "const password = process.env.PASSWORD"],
    ["form.html", '<input type="password" name="password" placeholder="Password">'],
    ["i18n.json", '"password": "Password",'],
    ["models.py", "password_hash = db.Column(db.String(255))"],
    ["config.py", "SECRET_KEY = os.environ.get('SECRET_KEY')"],
    [".env.example", "DATABASE_URL=postgresql://user:password@localhost/db"],
    ["config.js", "apiKey: 'YOUR_API_KEY_GOES_HERE'"],
    ["auth.ts", "const confirmPassword = 'confirm-password-field';"],
    ["config/database.yml", "#   DATABASE_URL=\"postgres://myuser:mypass@localhost/somedatabase\""],
  ])("ignores %s", (path, line) => {
    expect(scanLineForSecrets(line, path)).toBeNull();
  });

  it("only reads unquoted assignments in env and shell files", () => {
    expect(scanLineForSecrets("MAIL_PASSWORD=hunter2hunter2", "notes.md")).toBeNull();
    expect(scanLineForSecrets("MAIL_PASSWORD=hunter2hunter2", ".env")?.ruleId).toBe("password-env");
  });

  it("recognises committed env files but not examples", () => {
    expect(isCommittedEnvFile(".env")).toBe(true);
    expect(isCommittedEnvFile("api/.env.production")).toBe(true);
    expect(isCommittedEnvFile(".env.example")).toBe(false);
    expect(isCommittedEnvFile(".env.sample")).toBe(false);
  });
});

describe("masking", () => {
  it("never returns more than three real characters", () => {
    expect(mask("supersecretvalue")).toBe("sup••••••••");
    expect(mask("abc")).toBe("••••");
  });

  it("keeps the raw value out of findings and context", () => {
    const result = scanRepoFiles("demo", [{ path: "start.sh", content: "export X=1\nexport MAIL_PASSWORD='hunter2hunter2'\n" }], ["start.sh"]);
    const json = JSON.stringify(result.findings);
    expect(json).not.toContain("hunter2hunter2");
    expect(result.findings[0].masked).toBe("hun••••••••");
  });
});

describe("test files", () => {
  it("downgrades passwords inside unit tests", () => {
    const result = scanRepoFiles("demo", [{ path: "tests/test_user.py", content: "self.user = User(password='banana12')" }], ["tests/test_user.py"]);
    expect(result.findings[0].severity).toBe("high");
    expect(result.findings[0].title).toBe("Password in a test file");
  });
});

describe("personal data", () => {
  it("finds Kenyan phone numbers and emails in seed files", () => {
    const f = scanPersonalData("db/seed.js", "('Wanjiku', 'wanjiku@gmail.com', '+254 712 948 301'), ('Otieno', 'otis@yahoo.com', '0722 591 846')");
    expect(f?.count).toBe(4);
    expect(f?.title).toBe("2 phone numbers and 2 emails in test data");
    expect(f?.note).toMatch(/Data Protection Act/);
  });

  it("says when the data looks made up", () => {
    const f = scanPersonalData("seed.js", "('A', 'a@example.com', '+254 712 345 678'), ('B', 'b@email.com', '+221 77 123 4567')");
    expect(f?.note).toMatch(/look made up/);
  });

  it("finds KRA PINs anywhere", () => {
    expect(scanPersonalData("src/app.py", "pin = 'A012345678Z'")?.title).toMatch(/KRA PIN/);
  });

  it("ignores the author's own contact line in a README", () => {
    expect(scanPersonalData("README.md", "Email me at rose@example.com or call 0712 948 301")).toBeNull();
  });
});

describe("history", () => {
  it("marks secrets found only in old commits", () => {
    const { findings } = scanCommitPatches("demo", [
      { sha: "3f9a1c2deadbeef", files: [{ filename: "settings.py", patch: "@@ -1 +1 @@\n-SECRET_KEY = os.environ['K']\n+SECRET_KEY = 'q8#k2m!q9z@p4w7v1t6y3u0r5e'" }] },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].liveness).toBe("history");
    expect(findings[0].commit).toBe("3f9a1c2");
  });
});

describe("profile", () => {
  it("merges one key reused across repos", () => {
    const merged = mergeFindings([
      { id: "a", ruleId: "api-key-assignment", category: "secret", severity: "high", title: "API key", repo: "NewsNow", path: "config.py", liveness: "live", reuseKey: "k1" },
      { id: "b", ruleId: "api-key-assignment", category: "secret", severity: "high", title: "API key", repo: "global-news", path: "config.py", liveness: "live", reuseKey: "k1" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("API key reused in 2 repos");
  });

  it("spots copied READMEs but not a shared template", () => {
    const template = "## Setup\nClone the repository, move to the folder, install requirements with pip, export the configuration and run the application with python manage.py server then open it in your browser of choice.";
    const h = (repo: string, text: string): HygieneFacts => ({ repo, hasReadme: true, placeholderReadme: false, readmeText: text, committedDeps: [], demoLinks: [], fileCount: 10 });
    const news = "An application that allows users to preview and read news articles from various sources all around the world. The application consumes the NewsAPI providing top stories in a carousel and access to over fifty news sources of various categories displayed in card format on the landing page for every source.";
    const groups = findDuplicateGroups([
      h("NewsNow", news), h("NewsWave", news),
      ...["Pitch", "Blog", "Photos", "Hood", "Gram"].map((n) => h(n, `${n} is a unique app about ${n.toLowerCase()} things with its own features and its own story to tell. ${template}`)),
    ]);
    expect(groups).toEqual([["NewsNow", "NewsWave"]]);
  });

  it("detects starter READMEs", () => {
    expect(isPlaceholderReadme("# README\nThis README would normally document whatever steps are necessary to get the application up and running.")).toBe(true);
    expect(isPlaceholderReadme("# Goals\n\nThis project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 9.1.4.\n\n## Development server\n\nRun `ng serve` for a dev server. Navigate to localhost. The app will automatically reload if you change any of the source files.\n\n## Build\n\nRun `ng build`.")).toBe(true);
  });

  it("scores the recruiter view and skips the profile repo", () => {
    const meta = (name: string): RepoMeta => ({ name, description: null, homepage: null, fork: false, archived: false, pushedAt: "2020-06-01T00:00:00Z", sizeKb: 10, defaultBranch: "main" });
    const hyg = (repo: string, extra: Partial<HygieneFacts> = {}): HygieneFacts => ({ repo, hasReadme: true, placeholderReadme: false, readmeText: "", committedDeps: [], demoLinks: [], fileCount: 20, ...extra });
    const view = buildRecruiterView(
      "rose",
      [meta("rose"), meta("app"), meta("old")],
      [hyg("rose"), hyg("app", { demoLinks: ["https://app.herokuapp.com"] }), hyg("old", { hasReadme: false })],
      new Set(["https://app.herokuapp.com"]),
      "Here are some ideas to get you started:",
      Date.parse("2026-11-02"),
    );
    expect(view.deductions.map((d) => d.id)).toEqual(["dead-links", "readme", "description"]);
    expect(view.score).toBe(100 - 2 - 1 - 1);
    expect(view.archiveSuggestions).toEqual(["old"]);
    expect(view.profileReadmeIsStarter).toBe(true);
  });
});
