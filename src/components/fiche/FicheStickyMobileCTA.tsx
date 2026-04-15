import { Phone, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

interface Props {
  telephone: string | null;
  prestataireId: string;
  onDevisClick: () => void;
}

export default function FicheStickyMobileCTA({ telephone, prestataireId, onDevisClick }: Props) {
  const handleCall = () => {
    trackEvent("affichage_telephone", {}, prestataireId);
  };

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur border-t border-border p-3 safe-bottom">
      <div className="flex gap-2">
        <Button className="gap-2 flex-1" size="lg" onClick={onDevisClick}>
          <FileText size={16} />
          Demander un devis
        </Button>
        {telephone && (
          <Button variant="outline" size="lg" className="gap-2 flex-1" asChild onClick={handleCall}>
            <a href={`tel:${telephone}`}>
              <Phone size={16} />
              Appeler
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
