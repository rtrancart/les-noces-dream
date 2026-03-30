import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Prestataire = Tables<"prestataires">;

export function usePrestataire() {
  const { user } = useAuth();
  const [prestataire, setPrestataire] = useState<Prestataire | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    async function fetch() {
      const { data } = await supabase
        .from("prestataires")
        .select("*")
        .eq("user_id", user!.id)
        .single();

      setPrestataire(data);
      setLoading(false);
    }

    fetch();
  }, [user?.id]);

  const refetch = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("prestataires")
      .select("*")
      .eq("user_id", user.id)
      .single();
    setPrestataire(data);
  };

  return { prestataire, loading, refetch };
}
