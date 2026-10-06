import { forwardRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

export type { TurnstileInstance };

interface Props {
  onToken: (token: string | null) => void;
}

/** Clé de site publique (valeur par défaut si la variable d'env est absente). */
export const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || "0x4AAAAAAFPd39OfotSu2iy4";

const TurnstileWidget = forwardRef<TurnstileInstance, Props>(({ onToken }, ref) => (
  <div className="flex justify-center">
    <Turnstile
      ref={ref}
      siteKey={TURNSTILE_SITE_KEY}
      options={{ language: "fr", theme: "light" }}
      onSuccess={(t) => onToken(t)}
      onExpire={() => onToken(null)}
      onError={() => onToken(null)}
    />
  </div>
));
TurnstileWidget.displayName = "TurnstileWidget";

export default TurnstileWidget;
