// Edge Function : relay-message
// Insertion d'un message + dispatch email (3 cas). Les CTA email pointent vers
// les routes protégées existantes avec un query param `?demande=` consommé côté
// front pour pré-sélectionner la conversation.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SITE_URL = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://lesnoces.net'


  // --- Auth ---
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
  const token = authHeader.slice(7)

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token)
  if (claimsErr || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401)
  const userId = claimsData.claims.sub as string
  const isImpersonation = (claimsData.claims as Record<string, unknown>).is_impersonation === true

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  // --- Garde-fou impersonnification ---
  if (isImpersonation) {
    await admin.from('logs_admin').insert({
      admin_id: userId,
      action: 'impersonation_action_bloquee',
      entite: 'relay-message',
      entite_id: userId,
      details: { action_tentee: 'relay-message' },
    })
    return json({ error: 'Action non autorisée en mode impersonnification' }, 403)
  }

  // --- Validation body ---
  let body: { demande_id?: string; contenu?: string; expediteur_type?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const demande_id = body.demande_id?.trim()
  const contenu = body.contenu?.trim()
  const expediteur_type = body.expediteur_type
  if (
    !demande_id ||
    !contenu ||
    contenu.length > 5000 ||
    (expediteur_type !== 'prestataire' && expediteur_type !== 'visiteur')
  ) {
    return json({ error: 'Paramètres invalides' }, 400)
  }

  // --- Contexte ---
  const { data: demande, error: demErr } = await admin
    .from('demandes_devis')
    .select(`
      id, statut, profile_id, contact_id, email_contact, nom_contact,
      prestataire:prestataires!demandes_devis_prestataire_id_fkey (
        id, user_id, nom_commercial, telephone, email_contact, site_web, slug
      )
    `)
    .eq('id', demande_id)
    .maybeSingle()

  if (demErr || !demande || !demande.prestataire) {
    console.error('Demande introuvable', demErr)
    return json({ error: 'Demande introuvable' }, 400)
  }
  if (demande.statut === 'archive' || demande.statut === 'archivee') {
    return json({ error: 'Conversation archivée' }, 400)
  }

  const presta = demande.prestataire as {
    id: string; user_id: string; nom_commercial: string;
    telephone: string | null; email_contact: string; site_web: string | null; slug: string;
  }

  // --- Autorisation métier ---
  if (expediteur_type === 'prestataire' && presta.user_id !== userId) {
    return json({ error: 'Accès refusé' }, 403)
  }
  if (expediteur_type === 'visiteur' && demande.profile_id && demande.profile_id !== userId) {
    return json({ error: 'Accès refusé' }, 403)
  }

  // --- Récupérer infos destinataire ---
  let clientEmail: string | null = null
  let clientPrenom: string | null = null
  if (demande.profile_id) {
    const { data: prof } = await admin
      .from('profiles')
      .select('email, prenom')
      .eq('id', demande.profile_id)
      .maybeSingle()
    clientEmail = prof?.email ?? demande.email_contact
    clientPrenom = prof?.prenom ?? (demande.nom_contact?.split(' ')[0] ?? null)
  } else if (demande.contact_id) {
    const { data: ca } = await admin
      .from('contacts_anonymes')
      .select('email, prenom')
      .eq('id', demande.contact_id)
      .maybeSingle()
    clientEmail = ca?.email ?? demande.email_contact
    clientPrenom = ca?.prenom ?? (demande.nom_contact?.split(' ')[0] ?? null)
  } else {
    clientEmail = demande.email_contact
    clientPrenom = demande.nom_contact?.split(' ')[0] ?? null
  }

  // --- Insert message ---
  const { data: inserted, error: insErr } = await admin
    .from('messages')
    .insert({
      demande_id,
      expediteur_type,
      expediteur_id: userId,
      contenu,
    })
    .select('id')
    .single()

  if (insErr || !inserted) {
    console.error('Insert message échec', insErr)
    return json({ error: 'Insertion impossible' }, 500)
  }
  const message_id = inserted.id as string

  // --- Update statut ---
  await admin
    .from('demandes_devis')
    .update({ statut: 'en_discussion', updated_at: new Date().toISOString() })
    .eq('id', demande_id)
    .in('statut', ['nouveau', 'lu'])

  // --- Email dispatch ---
  const messageExtrait = contenu.length > 280 ? contenu.slice(0, 280) + '…' : contenu
  let templateName: string | null = null
  let recipientEmail: string | null = null
  let templateData: Record<string, unknown> = {}

  if (expediteur_type === 'prestataire' && demande.profile_id) {
    // CAS A : client avec compte
    templateName = 'notif_reponse_client_avec_compte'
    recipientEmail = clientEmail
    templateData = {
      clientPrenom,
      prestataireNom: presta.nom_commercial,
      messageExtrait,
      lienMessagerie: `${SITE_URL}/mon-compte/messagerie?demande=${demande_id}`,
    }
  } else if (expediteur_type === 'prestataire' && !demande.profile_id) {
    // CAS B : client sans compte — pas d'accès invité côté plateforme.
    // On affiche les coordonnées du prestataire pour une réponse hors plateforme,
    // et on propose la création de compte pour retrouver l'historique.
    templateName = 'notif_reponse_client_sans_compte'
    recipientEmail = clientEmail
    templateData = {
      clientPrenom,
      prestataireNom: presta.nom_commercial,
      prestataireEmail: presta.email_contact,
      prestataireTelephone: presta.telephone,
      messageExtrait,
      lienInscription: `${SITE_URL}/inscription?email=${encodeURIComponent(clientEmail ?? '')}&demande_id=${demande_id}`,
    }
  } else if (expediteur_type === 'visiteur') {
    // CAS C : notification prestataire
    templateName = 'notif_reponse_presta'
    recipientEmail = presta.email_contact
    templateData = {
      prestataireNom: presta.nom_commercial,
      clientNom: demande.nom_contact ?? clientPrenom ?? 'Un client',
      messageExtrait,
      lienMessagerie: `${SITE_URL}/espace-pro/demandes?demande=${demande_id}`,
    }
  }


  let emailError = false
  if (templateName && recipientEmail) {
    try {
      const { error: mailErr } = await admin.functions.invoke('send-transactional-email', {
        body: {
          templateName,
          recipientEmail,
          idempotencyKey: `msg-${message_id}`,
          templateData,
        },
      })
      if (mailErr) {
        console.error('send-transactional-email error', mailErr)
        emailError = true
      } else {
        await admin
          .from('messages')
          .update({ envoye_par_email: true })
          .eq('id', message_id)
      }
    } catch (e) {
      console.error('invoke email function failed', e)
      emailError = true
    }
  }

  return json({ success: true, message_id, email_error: emailError })
})
