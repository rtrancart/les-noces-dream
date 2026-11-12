import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import FicheDevisDialog from "@/components/fiche/FicheDevisDialog";
import { useTracking } from "@/hooks/useTracking";
import type { RecoAtelier } from "@/lib/atelier";

const vus = new Set<string>();

function chemin(url?: string) {
  if (!url) return null;
  let p: string | null;
  try { p = new URL(url).pathname; } catch { p = url.startsWith("/") ? url : null; }
  // Anciennes recommandations enregistrées avec /prestataires/<slug> (page catégorie) au lieu de la fiche.
  return p ? p.replace(/^\/prestataires\/([^/]+)\/?$/, "/prestataire/$1") : null;
}

export default function CarteReco({ reco, cleAffichage }: { reco: RecoAtelier; cleAffichage: string }) {
  const { trackAtelierRecoAffichee, trackAtelierRecoClic } = useTracking();
  const [devis, setDevis] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lien = chemin(reco.url);

  useEffect(() => {
    const el = ref.current;
    const cle = `${cleAffichage}:${reco.prestataire_id}`;
    if (!el || vus.has(cle)) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !vus.has(cle)) { vus.add(cle); trackAtelierRecoAffichee(reco.prestataire_id); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [cleAffichage, reco.prestataire_id, trackAtelierRecoAffichee]);

  return (
    <div ref={ref} className="rounded-2xl border border-atelier-filet bg-card overflow-hidden flex flex-col">
      <div className="relative aspect-[16/10] bg-atelier-lin">
        {reco.photo_principale && (
          <img src={reco.photo_principale} alt={reco.nom_commercial ?? ""} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {reco.hors_zone && (
          <span className="absolute top-2 left-2 rounded-full bg-card/95 px-2.5 py-1 font-sans text-[11px] font-semibold text-foreground">Hors zone</span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="font-sans text-[11px] tracking-[0.15em] uppercase text-atelier-or">{reco.sous_categorie || reco.categorie}</p>
        <p className="font-serif text-lg leading-snug text-foreground">{reco.nom_commercial}</p>
        {reco.ville && <p className="flex items-center gap-1 font-sans text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{reco.ville}</p>}
        {reco.raison && <p className="font-sans text-sm text-foreground/80 leading-relaxed">{reco.raison}</p>}
        <div className="mt-auto pt-2 flex flex-wrap gap-2 [&>*]:flex-1 [&>*]:min-w-fit">
          {lien ? (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to={lien} onClick={() => trackAtelierRecoClic(reco.prestataire_id, "fiche")}>Voir la fiche</Link>
            </Button>
          ) : <span />}
          <Button size="sm" className="rounded-full bg-atelier-or hover:bg-atelier-or/90"
            onClick={() => { trackAtelierRecoClic(reco.prestataire_id, "devis"); setDevis(true); }}>
            Demander un devis
          </Button>
        </div>
      </div>
      <FicheDevisDialog open={devis} onOpenChange={setDevis} prestataireId={reco.prestataire_id}
        prestataireName={reco.nom_commercial ?? "ce prestataire"} source="atelier" />
    </div>
  );
}
