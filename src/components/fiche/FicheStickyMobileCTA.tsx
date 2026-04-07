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
    // Log event
    supabase
      .from("evenements_prestataire")
      .insert({ prestataire_id: prestataireId, type: "vue_telephone" })
      .then();
  };

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border px-4 py-3 flex gap-3 safe-bottom">
      {telephone && (
        <Button
          variant="outline"
          className="flex-1 gap-2"
          asChild
          onClick={handleCall}
        >
          <a href={`tel:${telephone.replace(/\s/g, "")}`}>
            <Phone size={16} />
            Appeler
          </a>
        </Button>
      )}
      <Button className="flex-1 gap-2" onClick={onDevisClick}>
        <FileText size={16} />
        Demander un devis
      </Button>
    </div>
  );
}
