import { redirect } from "next/navigation";

export default function LegacyAccountPasswordRedirect() {
  redirect("/admin/account/password");
}
