import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTracking } from "@/hooks/useTracking";

export default function ScrollToTop() {
  const { pathname } = useLocation();
  const { trackPageView } = useTracking();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    // Push page_view dans dataLayer à chaque changement de route.
    // Le titre est résolu après le rendu de SeoHead — on attend un tick.
    const id = window.setTimeout(() => {
      trackPageView(pathname, document.title);
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
