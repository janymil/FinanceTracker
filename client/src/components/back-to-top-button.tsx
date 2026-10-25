import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * How far the page must be scrolled (in pixels) before the button appears.
 * Below this the page top is still in view, so the button would be noise.
 */
const SHOW_AFTER_PX = 400;

/**
 * Floating "go up" button.
 *
 * Long pages (landing, dashboard, reports) need a way back to the top without
 * dragging the scrollbar. The button stays out of the way until the reader has
 * scrolled past the first screen, then fades in at the bottom-right corner,
 * above the financial mascot (`bottom-28` keeps 16px of clearance over the
 * mascot's 80px avatar that sits at `bottom-4`).
 */
export function BackToTopButton() {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      setIsVisible(window.scrollY > SHOW_AFTER_PX);
    };

    // Sync once on mount so a restored scroll position shows the button at once
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  const handleClick = () => {
    // Readers who ask for less motion get an instant jump instead of a long
    // smooth glide back through the whole page.
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, left: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  };

  const label = t("Back to top");

  return (
    <Button
      type="button"
      size="icon"
      onClick={handleClick}
      aria-label={label}
      title={label}
      tabIndex={isVisible ? 0 : -1}
      className={cn(
        "fixed bottom-28 right-4 z-40 h-11 w-11 rounded-full sm:right-6",
        "bg-gradient-to-r from-blue-600 to-purple-600 text-white",
        "shadow-lg shadow-indigo-500/30 transition-all duration-300",
        "hover:-translate-y-0.5 hover:from-blue-500 hover:to-purple-500 hover:shadow-xl hover:shadow-indigo-500/40",
        "[&_svg]:size-5",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        isVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      )}
    >
      <ArrowUp aria-hidden="true" />
    </Button>
  );
}

export default BackToTopButton;
