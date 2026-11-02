import type { Finding } from "./scanner/types";

export interface FixStep {
  title: string;
  body: string;
  code?: string;
}

const purgeValue = (f: Finding): FixStep => ({
  title: "Scrub it from every old commit",
  body: "Deleting the line only hides it from the latest version. Put the old value in a file called secrets.txt (one per line), run this, then force-push. Copies in forks and clones won't be cleaned, which is why changing the secret comes first.",
  code: `pip install git-filter-repo\ngit filter-repo --replace-text secrets.txt\ngit push --force --all${f.alsoIn?.length ? `\n# Repeat in: ${f.alsoIn.join(", ")}` : ""}`,
});

const purgeFile = (path: string): FixStep => ({
  title: "Remove the file from every old commit",
  body: "This rewrites history so the file never existed. Run it in a fresh clone, then force-push.",
  code: `git filter-repo --path ${path} --invert-paths\ngit push --force --all`,
});

const useEnv: FixStep = {
  title: "Read it from the environment instead",
  body: "Move the value into a .env file that stays on your machine, add .env to .gitignore, and commit a .env.example with the names but no values.",
};

/** What a person should do, in order, for each kind of leak. Changing the secret always comes first. */
export function fixStepsFor(f: Finding): FixStep[] {
  if (f.liveness === "history" && f.category === "secret") {
    return [
      { title: "Change the secret", body: "It was deleted from the code, but it's still public in old commits, so treat it as leaked. Change the password or regenerate the key wherever it's used." },
      purgeValue(f),
    ];
  }

  switch (f.ruleId) {
    case "password-assignment":
    case "password-env":
      if (f.title.startsWith("Email account")) {
        return [
          { title: "Revoke the app password", body: "In your Google Account, go to Security, then App passwords, and remove it. If the email address isn't yours, tell the person it belongs to." },
          purgeValue(f),
          useEnv,
        ];
      }
      if (f.title.startsWith("Password in a test")) {
        return [
          { title: "Check it isn't a real password", body: "If it's a made-up test user, mark this as not a real secret. If you have used this password anywhere real, change it there." },
          { title: "Use an obviously fake value", body: "Test passwords like test-password-123 make it clear to anyone reading that nothing real is exposed." },
        ];
      }
      return [
        { title: "Change the password", body: "Change it on every system that uses it. If these are seed users for a live app, reset their passwords there too." },
        purgeValue(f),
        { title: "Seed from the environment", body: "Read seed passwords from environment variables, or generate random ones when the seed script runs and print them once." },
      ];
    case "connection-string":
      return [
        { title: "Change the database password", body: f.note ?? "Change it on the database server, then update the apps that connect to it." },
        purgeValue(f),
        useEnv,
      ];
    case "env-file":
      return [
        { title: "Change every value in the file", body: "Assume each password, key and token in it has leaked. Change or regenerate them one by one." },
        { title: "Stop tracking the file", body: "Remove it from git but keep it on your machine, and ignore it from now on.", code: `git rm --cached ${f.path}\necho ".env" >> .gitignore\ngit commit -m "Stop tracking .env"` },
        purgeFile(f.path),
      ];
    case "personal-data":
      return [
        { title: "Check whether the people are real", body: "If every name, number and email is made up, mark this as not real. If any are real, keep going." },
        { title: "Replace real details with fake ones", body: "Use a library like Faker to generate realistic test data, or numbers from the reserved test ranges, so nothing points at a real person." },
        purgeFile(f.path),
        { title: "Check if you need to report it", body: "If this is data you hold about real people, a public repo is a disclosure. Under the Kenya Data Protection Act (section 43) a data controller must notify the ODPC within 72 hours of a breach that poses a real risk of harm. GDPR has a similar 72-hour rule." },
      ];
    case "private-key":
      return [
        { title: "Revoke the key", body: "Remove it from every server, deploy service or account that trusts it, and generate a new key pair." },
        purgeValue(f),
      ];
    default:
      return [
        { title: "Regenerate the key", body: "Go to the service that issued it and revoke or regenerate it. The old one should stop working." },
        purgeValue(f),
        useEnv,
      ];
  }
}

export function whyItMatters(f: Finding): string {
  if (f.category === "personal") return f.note ?? "";
  if (f.ruleId === "env-file") return "Environment files usually hold every secret an app needs, and this one is public.";
  if (f.title.startsWith("Email account")) return "With this password and the username next to it, anyone can send email as that account. App passwords skip two-step sign-in, which is exactly why people go looking for them.";
  if (f.title.startsWith("Password in a test")) return "Usually harmless, but bots scrape public repos for passwords and try them everywhere. If this one was ever real, it's in their lists.";
  if (f.ruleId.startsWith("password")) return "Anyone browsing the repo can read this password. Bots scan public GitHub for exactly this, often within minutes of a push.";
  if (f.ruleId === "connection-string") return "This URL includes the database password. Anyone who can reach the database can log in with it.";
  return "Anyone can use this key as if they were you, and the bill or the blame lands on your account.";
}
