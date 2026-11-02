import { notFound } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Header } from "@/components/Header";
import { ProfileScan } from "@/components/ProfileScan";

const USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `${username} on RepoGuard`, robots: { index: false } };
}

export default async function UserPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (!USERNAME.test(username)) notFound();
  const session = await auth();

  async function signInHere() {
    "use server";
    await signIn("github", { redirectTo: `/u/${username}` });
  }

  return (
    <div className="wrap">
      <Header links={false} />
      <ProfileScan username={username} viewer={session?.login ?? null} signInAction={signInHere} />
    </div>
  );
}
