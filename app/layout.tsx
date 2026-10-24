import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SaaS Page Builder",
    template: "%s | SaaS Page Builder",
  },
  description:
    "Multi-tenant SaaS page builder with visual block composition, custom domains, and Row-Level Security.",
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="spb-root-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
