import { Phone, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  telephone: string | null;
  prestataireId: string;
  onDevisClick: () => void;
}

export default function FicheStickyMobileCTA({ telephone, prestataireId, onDevisClick }: Props) {
  const handleCall = () => {
    supabase
      .from("evenements_prestataire")
      .insert({ prestataire_id: prestataireId, type: "vue_telephone" })
      .then();
  };

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur border-t border-border p-3 safe-bottom">
      <div className="flex gap-2">
        {telephone && (
          <Button variant="outline" size="lg" className="gap-2 flex-1" asChild onClick={handleCall}>
            <a href={`tel:${telephone}`}>
              <Phone size={16} />
              Appeler
            </a>
          </Button>
        )}
        <Button className="gap-2 flex-1" size="lg" onClick={onDevisClick}>
          <FileText size={16} />
          Demander un devis
        </Button>
      </div>
    </div>
  );
}
