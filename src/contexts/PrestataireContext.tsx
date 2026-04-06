import { createContext, useContext, ReactNode } from "react";
import { usePrestataire } from "@/hooks/usePrestataire";
import type { Tables } from "@/integrations/supabase/types";

type Prestataire = Tables<"prestataires">;

interface PrestataireContextType {
  prestataire: Prestataire | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const PrestataireContext = createContext<PrestataireContextType | null>(null);

export function PrestataireProvider({ children }: { children: ReactNode }) {
  const value = usePrestataire();
  return (
    <PrestataireContext.Provider value={value}>
      {children}
    </PrestataireContext.Provider>
  );
}

export function useSharedPrestataire() {
  const ctx = useContext(PrestataireContext);
  if (!ctx) throw new Error("useSharedPrestataire must be used within PrestataireProvider");
  return ctx;
}
