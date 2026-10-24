"use client";

import { ErrorPanel } from "@/components/feedback/error-panel";

export default function RootError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return <ErrorPanel digest={error.digest} onReset={reset} />;
}
