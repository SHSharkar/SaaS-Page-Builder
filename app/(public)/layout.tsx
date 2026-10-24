import type { ReactNode } from "react";
import { PublicShell } from "@/components/app-shell/public-shell";

export default function PublicLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <PublicShell>{children}</PublicShell>;
}
