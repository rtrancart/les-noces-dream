import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

export default function AtelierBientot({ titre, description }: { titre: string; description: string }) {
  return (
    <div className="px-5 py-10 lg:px-12 lg:py-14 max-w-2xl">
      <p className="font-sans text-xs tracking-[0.2em] uppercase text-atelier-or">L'Atelier</p>
      <h1 className="font-serif text-3xl lg:text-4xl text-foreground mt-2">{titre}</h1>
      <div className="mt-6 rounded-2xl border border-atelier-filet bg-card p-6 space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-atelier-lin text-atelier-or"><Sparkles className="h-5 w-5" /></span>
        <p className="font-serif text-xl text-foreground">Bientôt disponible</p>
        <p className="font-sans text-sm text-muted-foreground leading-relaxed">{description}</p>
        <Link to="/atelier/assistant" className="inline-block font-sans text-sm font-semibold text-atelier-or hover:underline">
          En attendant, posez vos questions à l'assistant →
        </Link>
      </div>
    </div>
  );
}
