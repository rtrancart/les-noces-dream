import { forwardRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

export type { TurnstileInstance };

interface Props {
  onToken: (token: string | null) => void;
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

const TurnstileWidget = forwardRef<TurnstileInstance, Props>(({ onToken }, ref) => {
  if (!SITE_KEY) {
    return (
      <p className="font-sans text-xs text-muted-foreground text-center">
        Vérification anti-robot indisponible pour le moment.
      </p>
    );
  }
  return (
    <div className="flex justify-center">
      <Turnstile
        ref={ref}
        siteKey={SITE_KEY}
        options={{ language: "fr", theme: "light" }}
        onSuccess={(t) => onToken(t)}
        onExpire={() => onToken(null)}
        onError={() => onToken(null)}
      />
    </div>
  );
});
TurnstileWidget.displayName = "TurnstileWidget";

export default TurnstileWidget;
