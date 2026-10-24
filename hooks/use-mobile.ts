"use client";

import { useEffect, useState } from "react";

export function useMobile(breakpointPx = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }
    const query = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [breakpointPx]);

  return isMobile;
}
