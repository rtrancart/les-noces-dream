import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { EmailAPIError, sendLovableEmail } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { wrapWithShell } from '../_shared/email-shell.ts'
import { tagEmailLinks } from '../_shared/utm.ts'

// Envoi des emails applicatifs via l'API email managée de Lovable.
// La composition (contenu stocké en base, coquille commune, UTM, expéditeur
// par template) est spécifique au projet : elle ne peut pas passer par le
// helper de registre, l'envoi se fait donc directement.

// Configuration baked in at scaffold time — do NOT change these manually.
const SITE_NAME = "Site LesNoces.net"
// SENDER_DOMAIN is the verified sender subdomain FQDN.
const SENDER_DOMAIN = "notify.lesnoces.net"
// FROM_DOMAIN is the domain shown in the From: header.
const FROM_DOMAIN = "notify.lesnoces.net"
// Local-part de l'expéditeur, paramétrable par template. Par défaut "noreply".
const DEFAULT_FROM_LOCAL_PART = "noreply"
const FROM_LOCAL_PART_BY_TEMPLATE: Record<string, string> = {
  migration_m01_reactivation: 'reactivation',
  migration_m02_relance: 'reactivation',
  migration_m03_relance: 'reactivation',
  migration_m04_relance: 'reactivation',
  migration_m05_charte: 'reactivation',
}
function fromAddressFor(templateName: string): string {
  const local = FROM_LOCAL_PART_BY_TEMPLATE[templateName] ?? DEFAULT_FROM_LOCAL_PART
  return `${SITE_NAME} <${local}@${FROM_DOMAIN}>`
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const apiKey = Deno.env.get('LOVABLE_API_KEY')

  if (!supabaseUrl || !supabaseServiceKey || !apiKey) {
    console.error('Missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  let templateName: string
  let recipientEmail: string
  let idempotencyKey: string
  const messageId = crypto.randomUUID()
  let templateData: Record<string, any> = {}
  try {
    const body = await req.json()
    templateName = body.templateName || body.template_name
    recipientEmail = body.recipientEmail || body.recipient_email
    idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return jsonResponse({ error: 'Invalid JSON in request body' }, 400)
  }

  if (!templateName) {
    return jsonResponse({ error: 'templateName is required' }, 400)
  }

  // 1. Look up template from registry (early — needed to resolve recipient)
  const template = TEMPLATES[templateName]
  if (!template) {
    console.error('Template not found in registry', { templateName })
    return jsonResponse(
      {
        error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      },
      404
    )
  }

  const effectiveRecipient = template.to || recipientEmail
  if (!effectiveRecipient) {
    return jsonResponse(
      {
        error: 'recipientEmail is required (unless the template defines a fixed recipient)',
      },
      400
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const logSend = async (
    status: 'sent' | 'suppressed' | 'failed',
    errorMessage?: string
  ) => {
    const { error } = await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status,
      ...(errorMessage ? { error_message: errorMessage.slice(0, 1000) } : {}),
    })
    if (error) {
      console.error('Failed to write email_send_log', {
        code: error.code,
        message: error.message,
        status,
      })
    }
  }

  // Defense in depth: migrated providers belong exclusively to migration
  // chain M. Keep this server-side guard so an older deployed admin bundle
  // cannot send the standard publication email.
  if (templateName === 'validation_publication_fiche') {
    const normalizedRecipient = effectiveRecipient.trim().toLowerCase()
    const { data: directProvider, error: directProviderError } = await supabase
      .from('prestataires')
      .select('id, origine')
      .ilike('email_contact', normalizedRecipient)
      .eq('origine', 'migration')
      .limit(1)
      .maybeSingle()

    if (directProviderError) {
      console.error('Migration publication guard lookup failed', {
        error: directProviderError,
        recipient: normalizedRecipient,
      })
      return jsonResponse({ error: 'Failed to verify publication email eligibility' }, 500)
    }

    let migratedProvider = directProvider
    if (!migratedProvider) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', normalizedRecipient)
        .limit(1)
        .maybeSingle()

      if (profileError) {
        console.error('Migration publication profile lookup failed', {
          error: profileError,
          recipient: normalizedRecipient,
        })
        return jsonResponse({ error: 'Failed to verify publication email eligibility' }, 500)
      }

      if (profile?.id) {
        const { data: linkedProvider, error: linkedProviderError } = await supabase
          .from('prestataires')
          .select('id, origine')
          .eq('user_id', profile.id)
          .eq('origine', 'migration')
          .limit(1)
          .maybeSingle()

        if (linkedProviderError) {
          console.error('Migration publication linked provider lookup failed', {
            error: linkedProviderError,
            recipient: normalizedRecipient,
          })
          return jsonResponse({ error: 'Failed to verify publication email eligibility' }, 500)
        }
        migratedProvider = linkedProvider
      }
    }

    if (migratedProvider) {
      console.warn('Publication email skipped for migrated provider', {
        providerId: migratedProvider.id,
        recipient: normalizedRecipient,
      })
      return jsonResponse({ success: true, skipped: true, reason: 'migration_chain_only' })
    }
  }

  // 2. Resolve content — DB (email_textes) is source of truth if active,
  // otherwise fall back to the React Email component (safety net).
  const { data: dbTexte, error: dbTexteError } = await supabase
    .from('email_textes')
    .select('sujet, sous_objet, corps_html, est_actif')
    .eq('template_name', templateName)
    .maybeSingle()

  if (dbTexteError) {
    console.warn('email_textes lookup failed, falling back to code default', {
      templateName,
      error: dbTexteError.message,
    })
  }

  const substitute = (tpl: string): { out: string; unresolved: string[] } => {
    const unresolved = new Set<string>()
    const out = tpl.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, key: string) => {
      const val = templateData?.[key]
      if (val === undefined || val === null || val === '') {
        unresolved.add(key)
        return `{{${key}}}`
      }
      return String(val)
    })
    return { out, unresolved: [...unresolved] }
  }

  let html: string
  let plainText: string
  let resolvedSubject: string
  let contentSource: 'db' | 'code' = 'code'
  const unresolvedVars = new Set<string>()

  if (
    dbTexte?.est_actif &&
    typeof dbTexte.sujet === 'string' && dbTexte.sujet.trim().length > 0 &&
    typeof dbTexte.corps_html === 'string' && dbTexte.corps_html.trim().length > 0
  ) {
    contentSource = 'db'
    const subjectSub = substitute(dbTexte.sujet)
    const bodySub = substitute(dbTexte.corps_html)
    resolvedSubject = subjectSub.out
    // Coquille commune (header + footer + signature) : appliquée si le
    // contenu stocké est un corps seul. Les anciens gabarits full-doc
    // sont détectés et laissés intacts par wrapWithShell.
    html = wrapWithShell(templateName, bodySub.out)
    plainText = bodySub.out.replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    subjectSub.unresolved.forEach((v) => unresolvedVars.add(v))
    bodySub.unresolved.forEach((v) => unresolvedVars.add(v))
  } else {
    const element = React.createElement(template.component, templateData)
    html = await renderAsync(element)
    plainText = await renderAsync(element, { plainText: true })
    resolvedSubject =
      typeof template.subject === 'function'
        ? template.subject(templateData)
        : template.subject
  }

  // Sous-objet (preheader) : court texte d'aperçu affiché après l'objet dans
  // la boîte de réception. Injecté masqué en tête du <body> quand il est
  // renseigné en base pour ce template.
  if (contentSource === 'db' && typeof dbTexte?.sous_objet === 'string' && dbTexte.sous_objet.trim()) {
    const pre = substitute(dbTexte.sous_objet.trim())
    pre.unresolved.forEach((v) => unresolvedVars.add(v))
    html = injectPreheader(html, pre.out)
  }

  // Tag every site link with UTM params (post-render, covers both DB and
  // code templates). The unsubscribe link is appended downstream, so it is
  // never affected here.
  html = tagEmailLinks(html, templateName)

  if (unresolvedVars.size > 0) {
    // Incident: an email is going out with unfilled placeholders.
    // Logged loudly but the send is NOT blocked.
    console.error('email_var_incident', {
      templateName,
      recipient: effectiveRecipient,
      messageId,
      unresolved: [...unresolvedVars],
      source: contentSource,
    })
  }

  // 3. Send through Lovable's managed email API. Suppression, retries and
  // rate limits are enforced server-side by Lovable.
  try {
    await sendLovableEmail(
      {
        to: effectiveRecipient,
        from: fromAddressFor(templateName),
        sender_domain: SENDER_DOMAIN,
        subject: resolvedSubject,
        html,
        text: plainText,
        purpose: 'transactional',
        label: templateName,
        idempotency_key: idempotencyKey,
      },
      { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') }
    )
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === 'recipient_suppressed') {
      await logSend('suppressed')
      console.log('Email suppressed', { templateName })
      return jsonResponse({ success: false, reason: 'email_suppressed' })
    }

    const errorMsg = error instanceof Error ? error.message : String(error)
    await logSend('failed', errorMsg)
    console.error('Email send failed', { templateName, error: errorMsg })
    return jsonResponse({ error: 'Failed to send email' }, 500)
  }

  await logSend('sent')
  console.log('Transactional email sent', { templateName })

  return jsonResponse({ success: true, sent: true, queued: false })
})
