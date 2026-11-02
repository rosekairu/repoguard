import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { LogoMark } from "./LogoMark";

/** Site header. Sign-in and sign-out are server actions, so no auth code ships to the browser. */
export async function Header({ links = true, current }: { links?: boolean; current?: "checks" }) {
  const session = await auth();
  const login = session?.login;
  return (
    <header className="site-header">
      <Link href="/" className="logo" aria-label="RepoGuard home">
        <LogoMark size={36} />
        <span>repoguard</span>
      </Link>
      <nav className="nav" aria-label="Main">
        {links && (
          <Link href="/checks" aria-current={current === "checks" ? "page" : undefined} className={current === "checks" ? "nav-current" : undefined}>
            What it checks
          </Link>
        )}
        {login ? (
          <>
            <Link href={`/u/${login}`}>Your report</Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className="btn btn-sm">Sign out</button>
            </form>
          </>
        ) : (
          <SignInButton />
        )}
      </nav>
    </header>
  );
}

export function SignInButton({ label = "Sign in with GitHub", primary = false, redirectTo = "/me" }: { label?: string; primary?: boolean; redirectTo?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("github", { redirectTo });
      }}
    >
      <button className={primary ? "btn btn-primary" : "btn btn-sm btn-raised"}>{label}</button>
    </form>
  );
}
