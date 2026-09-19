"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type DocWithVT = Document & {
  startViewTransition?: (callback: () => void) => void;
};

/**
 * Upgrades every same-origin link navigation into a View Transition
 * (Chrome/Edge; everywhere else it silently falls back to normal routing).
 * External links, downloads, new-tab clicks and hash jumps are untouched.
 */
export function ViewTransitionAgent() {
  const router = useRouter();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      let url: URL;
      try {
        url = new URL(href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      const doc = document as DocWithVT;
      if (typeof doc.startViewTransition !== "function") return;
      event.preventDefault();
      doc.startViewTransition(() => {
        router.push(url.pathname + url.search + url.hash);
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router]);

  return null;
}
