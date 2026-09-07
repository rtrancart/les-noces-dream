import { Link } from "react-router-dom";
import { Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  /** "info" = pédagogie / upsell, "alerte" = du contenu existe mais n'est plus visible */
  ton?: "info" | "alerte";
  titre: string;
  description: string;
  ctaLabel?: string;
  className?: string;
}

export default function PremiumBanner({
  ton = "info",
  titre,
  description,
  ctaLabel = "Passer en Premium",
  className,
}: Props) {
  const alerte = ton === "alerte";
  const Icon = alerte ? AlertTriangle : Sparkles;

  return (
    <div
      className={cn(
        "rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-3",
        alerte
          ? "border-terracotta/30 bg-terracotta/5"
          : "border-primary/25 bg-gradient-to-br from-primary/5 to-champagne/10",
        className,
      )}
    >
      <Icon
        className={cn("h-5 w-5 shrink-0", alerte ? "text-terracotta" : "text-primary")}
        aria-hidden
      />
      <div className="flex-1 space-y-0.5">
        <p className="font-sans text-sm font-semibold text-foreground">{titre}</p>
        <p className="font-sans text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <Button asChild size="sm" variant={alerte ? "default" : "outline"} className="font-sans shrink-0">
        <Link to="/espace-pro/abonnement">{ctaLabel}</Link>
      </Button>
    </div>
  );
}
