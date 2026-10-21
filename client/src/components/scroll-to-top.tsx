import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Resets the scroll position to the top whenever the route changes.
 * Without this, navigating from a long page (e.g. the dashboard) leaves the
 * next page scrolled to the bottom.
 */
export function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    // Jump (not smooth) so the new page starts at the top immediately
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location]);

  return null;
}

export default ScrollToTop;
