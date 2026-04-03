import { ClipboardList } from "lucide-react";

export default function PrestatairePrestation() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-secondary/30 rounded-full flex items-center justify-center mb-4">
        <ClipboardList className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="font-serif text-2xl text-foreground mb-2">Ma prestation</h2>
      <p className="font-sans text-muted-foreground max-w-md">
        Cette page sera bientôt disponible. Vous pourrez y détailler les spécificités de votre prestation
        en fonction de votre catégorie de service.
      </p>
    </div>
  );
}
