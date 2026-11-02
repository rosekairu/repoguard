import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

/** After sign-in, send people straight to their own report. */
export default async function Me() {
  const session = await auth();
  if (session?.login) redirect(`/u/${session.login}`);
  await signIn("github", { redirectTo: "/me" });
}
