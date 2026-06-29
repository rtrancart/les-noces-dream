import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: prestataires, error: errP } = await supabase
      .from('prestataires')
      .select('id, taux_reponse_alerte_envoyee_le')
      .eq('statut', 'actif')

    if (errP) throw errP

    let scanned = 0
    let updated = 0
    let alertes = 0

    // Récupérer la liste d'admins une seule fois
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['admin', 'super_admin'])
    const adminIds = Array.from(new Set((admins ?? []).map((a) => a.user_id)))

    const trenteJoursMs = 30 * 24 * 60 * 60 * 1000

    for (const p of prestataires ?? []) {
      scanned++
      const { data: calc, error: errCalc } = await supabase.rpc('calculer_taux_reponse', {
        p_prestataire_id: p.id,
      })
      if (errCalc) {
        console.error('calc error', p.id, errCalc)
        continue
      }
      const row = Array.isArray(calc) ? calc[0] : calc
      if (!row || row.taux === null) continue

      const taux = Number(row.taux)
      const nb = Number(row.nb_demandes)

      const { error: errU } = await supabase
        .from('prestataires')
        .update({
          taux_reponse: taux,
          taux_reponse_nb_demandes_90j: nb,
          taux_reponse_calcule_le: new Date().toISOString(),
        })
        .eq('id', p.id)
      if (errU) {
        console.error('update error', p.id, errU)
        continue
      }
      updated++

      if (taux < 70) {
        const dernier = p.taux_reponse_alerte_envoyee_le
          ? new Date(p.taux_reponse_alerte_envoyee_le).getTime()
          : 0
        if (Date.now() - dernier >= trenteJoursMs) {
          await supabase.from('logs_admin').insert({
            admin_id: '00000000-0000-0000-0000-000000000000',
            action: 'revue_taux_reponse_declenchee',
            entite: 'prestataires',
            entite_id: p.id,
            details: { taux, nb_demandes: nb, seuil: 70 },
          })

          if (adminIds.length > 0) {
            await supabase.from('notifications').insert(
              adminIds.map((uid) => ({
                user_id: uid,
                type: 'systeme',
                titre: 'Taux de réponse sous le seuil Charte Qualité',
                corps: `Prestataire en alerte : taux de réponse ${taux}% sur ${nb} demandes (90 jours). Seuil contractuel : 70%.`,
                lien: `/admin/prestataires/${p.id}`,
              })),
            )
          }

          await supabase
            .from('prestataires')
            .update({ taux_reponse_alerte_envoyee_le: new Date().toISOString() })
            .eq('id', p.id)

          alertes++
        }
      }
    }

    return new Response(JSON.stringify({ scanned, updated, alertes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
