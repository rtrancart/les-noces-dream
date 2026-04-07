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
    <div className="md:hidden fixed bottom-0 right-0 z-50 p-4 safe-bottom">
      <Button className="gap-2 shadow-lg rounded-full px-6" size="lg" onClick={onDevisClick}>
        <FileText size={16} />
        Devis
      </Button>
    </div>
  );
}
