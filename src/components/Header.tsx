import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";

/** Site header. Sign-in and sign-out are server actions, so no auth code ships to the browser. */
export async function Header({ links = true }: { links?: boolean }) {
  const session = await auth();
  const login = session?.login;
  return (
    <header className="site-header">
      <Link href="/" className="logo">
        repoguard
      </Link>
      <nav className="nav" aria-label="Main">
        {links && (
          <>
            {/* Plain anchors: in-page jumps don't need client-side routing, and Next's Link didn't scroll to the hash */}
            <a href="/#checks">What it checks</a>
            <a href="/#next">What&apos;s next</a>
          </>
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
