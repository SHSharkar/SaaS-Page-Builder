import { auth } from "@/lib/auth/server";
import { DEMO_PASSWORD } from "@/lib/demo-accounts";

export async function signedInHeaders(email: string, password = DEMO_PASSWORD): Promise<Headers> {
  const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  if (!response.ok) throw new Error(`Sign-in failed for ${email}: ${await response.text()}`);
  const cookies = response.headers.getSetCookie().map((entry) => entry.split(";")[0]);
  if (cookies.length === 0) throw new Error(`No session cookie was issued for ${email}.`);
  return new Headers({ cookie: cookies.join("; ") });
}
