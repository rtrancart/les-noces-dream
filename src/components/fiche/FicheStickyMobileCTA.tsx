import { useState } from "react";
import { Phone, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  hasPhone: boolean;
  /** Enregistre le clic et renvoie le numéro de la fiche. */
  onCall: () => Promise<string | null>;
  onDevisClick: () => void;
}

export default function FicheStickyMobileCTA({ hasPhone, onCall, onDevisClick }: Props) {
  const [loading, setLoading] = useState(false);

  const handleCall = async () => {
    setLoading(true);
    const tel = await onCall();
    setLoading(false);
    if (tel) window.location.href = `tel:${tel.replace(/\s/g, "")}`;
  };

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur border-t border-border p-3 safe-bottom">
      <div className="flex gap-2">
        <Button className="gap-2 flex-1" size="lg" onClick={onDevisClick}>
          <FileText size={16} />
          Demander un devis
        </Button>
        {hasPhone && (
          <Button variant="outline" size="lg" className="gap-2 flex-1" onClick={handleCall} disabled={loading}>
            <Phone size={16} />
            Appeler
          </Button>
        )}
      </div>
    </div>
  );
}
