"use client";

import { ErrorPanel } from "@/components/feedback/error-panel";
import { APP_PATHS } from "@/lib/paths";

export default function WorkspaceError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <ErrorPanel
      digest={error.digest}
      homeHref={APP_PATHS.dashboard}
      onReset={reset}
    />
  );
}
