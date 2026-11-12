import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** Document scrolling is shared by public pages and the persistent workspace layout. */
export function NavigationEffects() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef({ page: location.pathname + location.search, key: location.key });

  useLayoutEffect(() => {
    const page = location.pathname + location.search;
    const changedPage = previous.current.page !== page;
    const navigated = previous.current.key !== location.key;
    previous.current = { page, key: location.key };

    if (changedPage) {
      const content = document.querySelector<HTMLElement>("main");
      if (content) {
        content.classList.remove("route-enter");
        // Restart only on a page navigation, including when React reuses the same main.
        void content.offsetWidth;
        content.classList.add("route-enter");
      }
    }
    // Preserve the browser's native history restoration, including hash traversal.
    if (navigationType === "POP") return;
    if (location.hash) {
      let id: string;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
      const reveal = () => {
        const target = document.getElementById(id) ?? document.getElementsByName(id)[0];
        if (!target) return false;
        target.scrollIntoView({ behavior: "instant", block: "start" });
        return true;
      };
      if (reveal()) return;
      // The destination can arrive after a query/loading state resolves.
      const observer = new MutationObserver(() => { if (reveal()) observer.disconnect(); });
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
    if (changedPage && navigated) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname, location.search, location.hash, location.key, navigationType]);

  return null;
}
