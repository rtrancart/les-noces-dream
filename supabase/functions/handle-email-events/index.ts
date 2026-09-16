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
    },
  },
})

Deno.serve((req) => handler(req))
