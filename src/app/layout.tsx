import type { Metadata } from "next";
// Fonts are bundled and served from this site: no requests to Google, which suits a privacy tool.
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/figtree";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.AUTH_URL ?? "https://repoguard-one.vercel.app"),
  title: "RepoGuard: see what your GitHub is oversharing",
  description:
    "Scan a GitHub profile for passwords in seed files, personal data in test fixtures, secrets in old commits, and the dead links recruiters click first.",
  openGraph: { siteName: "RepoGuard", type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
