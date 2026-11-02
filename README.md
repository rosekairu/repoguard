# RepoGuard

See what your GitHub profile is oversharing.

RepoGuard scans every public repo on a GitHub profile for the leaks that standard secret scanners skip, personal data that shouldn't be public, and the small things that make a profile look abandoned to a recruiter. Then it tells you how to fix each one, in order.

## What it checks

**Secrets other scanners miss.** GitHub already scans public repos for provider tokens (AWS, Stripe and so on). RepoGuard looks for the rest:

- passwords in seed scripts, fixtures and config files
- database URLs with the password inside (`postgresql://user:pass@host`)
- committed `.env` files
- email app passwords in shell scripts
- API keys and framework secret keys (Django `SECRET_KEY`, for example)
- the same key pasted into several repos, merged into one finding so one rotation fixes them all
- **old commits**: secrets deleted from the code but still readable in history

**Personal data.** Kenyan phone numbers, KRA PINs, ID numbers, and emails or phone numbers in seed and test files, with a note on what the Kenya Data Protection Act and GDPR expect when real people's details are published. It recognises obviously made-up test data and says so.

**What recruiters see.** A score out of 100 based on dead demo links, committed `node_modules` or virtualenvs, missing or untouched READMEs, near-copy repos, missing descriptions and a starter profile README, plus a list of old repos worth archiving.

## Privacy by design

- **Owner-only details.** Anyone can scan any username, but they only see counts. File paths, line numbers and values are shown only to the account owner, signed in with GitHub.
- **No repo-by-repo probing.** A visitor's browser receives each repo's result sealed (AES-256-GCM, server key). The summary endpoint only opens them when every repo is present, so a visitor can't tell which repo leaks.
- **Secrets never leave the server.** Values are masked to their first three characters plus a fixed-length mask. Reuse across repos is tracked with an HMAC, not the value or a plain hash.
- **Minimal GitHub access.** Sign-in asks for `read:user` only: no private repos, no write access.
- **Nothing stored.** Repos are downloaded as tarballs, read in memory and thrown away. There is no database. "Mark fixed" lives in your browser's local storage.
- **No third-party requests from the page.** Fonts are bundled, not loaded from Google.
- **The link checker can't be abused.** It only checks hosting platforms (Heroku, GitHub Pages, Netlify, Vercel and similar), so it can't be pointed at internal addresses.

## Running it locally

1. Create a GitHub OAuth app at **Settings > Developer settings > OAuth Apps** with callback URL `http://localhost:3000/api/auth/callback/github`.
2. Create a fine-grained personal access token with no repository permissions. It's used for scans by visitors who aren't signed in.
3. Copy `.env.example` to `.env.local` and fill it in. Generate `AUTH_SECRET` with `npx auth secret`.
4. Run:

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm test                              # detector and scoring tests
npm run typecheck
npm run scan:local -- ~/code          # scan a folder of cloned repos, no GitHub calls
```

## Deploying

Deploys to Vercel as-is. Set the four variables from `.env.example`, and add your production callback URL (`https://your-domain/api/auth/callback/github`) to the OAuth app.

## How it's built

- Next.js (App Router) and TypeScript
- Auth.js with the GitHub provider
- `src/lib/scanner/` is the engine: pure functions with no network access, so they're easy to test and reuse
- `src/lib/github.ts` downloads repo tarballs and commit diffs
- The browser scans four repos at a time and reads old commits in the background while the report is already on screen

## Known limits in v1

- The in-memory cache and rate limits are per server instance. Fine for a portfolio deployment; a busy deployment would want Redis.
- History scanning reads up to 150 recent commits per repo.
- Forks are skipped: they are mostly other people's code.

## Coming in version 2

- Fix-it pull requests
- Weekly rescans by email
- A "clean profile" README badge
- Bootcamp mode for scanning a whole cohort privately

---

Built by [Rose Kairu](https://rosekairu.com).
