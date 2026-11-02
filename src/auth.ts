import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

declare module "next-auth" {
  interface Session {
    login?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      // Public profile only. RepoGuard never asks for access to private repos or write access.
      authorization: { params: { scope: "read:user" } },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  callbacks: {
    jwt({ token, account, profile }) {
      if (account?.access_token) token.accessToken = account.access_token;
      if (profile && "login" in profile) token.login = String(profile.login);
      return token;
    },
    // Only the login reaches the browser. The GitHub access token stays in the encrypted cookie
    // and is read on the server by getViewer().
    session({ session, token }) {
      session.login = typeof token.login === "string" ? token.login : undefined;
      return session;
    },
  },
});
