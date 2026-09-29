import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Journalisation des évènements terminaux (rebond, plainte, désinscription).
// Notification uniquement : la suppression réelle des envois est assurée par
// Lovable au moment de l'envoi.

type Reason = 'bounce' | 'complaint' | 'unsubscribe'
type LogStatus = 'bounced' | 'complained' | 'suppressed'

const MESSAGES: Record<Reason, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

async function record(
  eventId: string,
  recipient: string,
  reason: Reason,
  status: LogStatus
): Promise<void> {
  const supabase = admin()
  const normalizedEmail = String(recipient).toLowerCase()

  // 1. Upsert to suppressed_emails (idempotent — safe for redeliveries)
  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      { email: normalizedEmail, reason, metadata: null },
      { onConflict: 'email' }
    )

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      event_id: eventId,
      code: suppressError.code,
      message: suppressError.message,
    })
    throw new Error('Failed to write suppression')
  }

  // 2. Append a log entry for the event (never update existing rows)
  const { error: insertError } = await supabase.from('email_send_log').insert({
    message_id: null,
    template_name: 'system',
    recipient_email: normalizedEmail,
    status,
    error_message: MESSAGES[reason],
    metadata: null,
  })

  if (insertError) {
    // Non-fatal — the suppression record is already stored.
    console.warn('Failed to insert email_send_log', {
      event_id: eventId,
      code: insertError.code,
      message: insertError.message,
    })
  }
}


// Désinscription d'un prestataire migré jamais activé → archivage (refus_migration)
// + invalidation des tokens d'invitation actifs. Fiche activée : inchangée.
// Plusieurs fiches sur la même adresse : aucune action, signalement pour décision admin.
async function archiverMigreNonActive(eventId: string, recipient: string): Promise<void> {
  const supabase = admin()
  const email = String(recipient).trim().toLowerCase()
  if (!email) return
  const { data, error } = await supabase
    .from('prestataires')
    .select('id, email_contact, statut, premier_login_le, origine')
    .ilike('email_contact', `%${email.replace(/[%_]/g, '\\$&')}%`)
  if (error) {
    console.error('archivage migré: lecture', { event_id: eventId, message: error.message })
    throw new Error('lookup failed')
  }
  const fiches = (data ?? []).filter(
    (p) => String(p.email_contact ?? '').trim().toLowerCase() === email
  )
  const cibles = fiches.filter((p) => p.origine === 'migration' && !p.premier_login_le)
  if (cibles.length === 0) return
  if (fiches.length > 1) {
    console.warn('archivage migré: adresse partagée, décision admin requise', {
      event_id: eventId,
      fiche_ids: fiches.map((f) => f.id),
    })
    return
  }
  const cible = cibles[0]
  if (cible.statut === 'archive') return
  const now = new Date().toISOString()
  const { error: upErr } = await supabase
    .from('prestataires')
    .update({ statut: 'archive', motif_suspension: 'refus_migration', archive_le: now })
    .eq('id', cible.id)
    .is('premier_login_le', null)
    .select('id')
  if (upErr) {
    console.error('archivage migré: update', { event_id: eventId, message: upErr.message })
    throw new Error('archive failed')
  }
  await supabase
    .from('invitation_tokens')
    .update({ expires_at: now })
    .eq('prestataire_id', cible.id)
    .is('consumed_at', null)
    .gt('expires_at', now)
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await record(event.event_id, event.data.recipient, 'bounce', 'bounced')
    },
    'email.complaint': async (event) => {
      await record(event.event_id, event.data.recipient, 'complaint', 'complained')
    },
    'email.unsubscribed': async (event) => {
      await record(event.event_id, event.data.recipient, 'unsubscribe', 'suppressed')
      await archiverMigreNonActive(event.event_id, event.data.recipient)
    },
  },
})

Deno.serve((req) => handler(req))
