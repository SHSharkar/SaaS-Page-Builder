"use client";

import { useCallback, useState } from "react";

export function useCopyToClipboard(): {
  copied: boolean;
  copyText: (text: string) => Promise<boolean>;
} {
  const [copied, setCopied] = useState(false);

  const copyText = useCallback(async (text: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return false;
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    return true;
  }, []);

  return { copied, copyText };
}
