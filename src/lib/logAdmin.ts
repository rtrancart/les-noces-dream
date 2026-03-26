import { supabase } from "@/integrations/supabase/client";

/**
 * Insert a row into logs_admin for auditing admin actions.
 * Silently catches errors to avoid blocking the main flow.
 */
export async function logAdmin(
  action: string,
  entite?: string,
  entite_id?: string,
  details?: Record<string, unknown>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("logs_admin").insert([{
      admin_id: user.id,
      action,
      entite: entite ?? null,
      entite_id: entite_id ?? null,
      details: (details as Record<string, unknown>) ?? null,
    }]);
  } catch {
    // Silent — logging should never block the UI
  }
}
