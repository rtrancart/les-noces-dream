// Inscription publique (mariés et prestataires) protégée par Cloudflare Turnstile.
// L'inscription directe est coupée côté authentification : cette fonction est
// le seul chemin de création de compte en libre-service.
//
// GET  → { turnstile_actif: boolean }   (interrupteur lu par le formulaire)
// POST → vérifie le jeton, applique la limite par IP, crée le compte non
//        confirmé et envoie l'email de confirmation habituel.
//
// Retour arrière immédiat : secret TURNSTILE_DESACTIVE=true → jeton non exigé.
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { sendLovableEmail } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3.23.8'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'

const SITE_NAME = 'LesNoces.net'
const SENDER_DOMAIN = 'notify.lesnoces.net'
const FROM_DOMAIN = 'lesnoces.net'
const SITE_URL = 'https://lesnoces.net'
const LIMITE_PAR_HEURE = 10

const ORIGINES_AUTORISEES = [
  /^https:\/\/(www\.)?lesnoces\.net$/,
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
]

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(6).max(72),
  prenom: z.string().trim().max(100).optional().default(''),
  nom: z.string().trim().max(100).optional().default(''),
  role: z.enum(['client', 'prestataire']),
  consentement_marketing: z.boolean().optional().default(false),
  nom_commercial: z.string().trim().max(200).optional().default(''),
  raison_sociale: z.string().trim().max(200).optional().default(''),
  redirect_to: z.string().url().max(500),
  captcha_token: z.string().max(4096).optional().nullable(),
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const turnstileActif = () =>
  (Deno.env.get('TURNSTILE_DESACTIVE') ?? '').toLowerCase() !== 'true'

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function verifierTurnstile(token: string, ip: string | null) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) return false
  const form = new FormData()
  form.append('secret', secret)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  })
  const data = await r.json().catch(() => ({}))
  return data?.success === true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method === 'GET') return json({ turnstile_actif: turnstileActif() })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let raw: unknown
  try { raw = await req.json() } catch { return json({ error: 'Requête invalide.' }, 400) }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    return json({ error: 'Champs invalides.', details: parsed.error.flatten().fieldErrors }, 400)
  }
  const d = parsed.data

  // Redirection uniquement vers nos domaines
  const redirect = new URL(d.redirect_to)
  if (!ORIGINES_AUTORISEES.some((re) => re.test(redirect.origin))) {
    return json({ error: 'Redirection non autorisée.' }, 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  // Limite par IP (stockée en base)
  const ip = (req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0] ?? '').trim() || null
  const ipHash = await sha256(`lesnoces:${ip ?? 'inconnue'}`)
  await admin.from('inscriptions_tentatives').delete()
    .lt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
  const { count } = await admin.from('inscriptions_tentatives')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString())
  if ((count ?? 0) >= LIMITE_PAR_HEURE) {
    return json({ error: 'Trop de tentatives. Réessayez dans une heure.' }, 429)
  }
  await admin.from('inscriptions_tentatives').insert({ ip_hash: ipHash })

  // Contrôle anti-robot
  if (turnstileActif()) {
    if (!d.captcha_token || !(await verifierTurnstile(d.captcha_token, ip))) {
      return json({ error: 'La vérification anti-robot a échoué. Merci de réessayer.', code: 'captcha' }, 400)
    }
  }

  // Création du compte (non confirmé) — mêmes métadonnées qu'auparavant
  const metadata: Record<string, unknown> = { prenom: d.prenom, nom: d.nom, role_souhaite: d.role }
  if (d.role === 'client') metadata.consentement_marketing = d.consentement_marketing
  if (d.role === 'prestataire') {
    metadata.nom_commercial = d.nom_commercial
    metadata.raison_sociale = d.raison_sociale || d.nom_commercial
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'signup',
    email: d.email,
    password: d.password,
    options: { data: metadata, redirectTo: d.redirect_to },
  })

  if (linkErr) {
    const msg = (linkErr.message || '').toLowerCase()
    // Adresse déjà utilisée : même réponse que l'inscription d'origine (pas d'énumération)
    if (msg.includes('already') || msg.includes('registered') || (linkErr as any).code === 'email_exists') {
      return json({ success: true })
    }
    if ((linkErr as any).code === 'weak_password' || msg.includes('password')) {
      return json({ error: linkErr.message }, 400)
    }
    console.error('generateLink failed', linkErr.message)
    return json({ error: "L'inscription a échoué. Merci de réessayer." }, 500)
  }

  const url = link.properties?.action_link
  if (!url) return json({ error: "L'inscription a échoué. Merci de réessayer." }, 500)

  try {
    const html = await renderAsync(React.createElement(SignupEmail, {
      siteName: SITE_NAME, siteUrl: SITE_URL, recipient: d.email, confirmationUrl: url,
    }))
    const text = await renderAsync(React.createElement(SignupEmail, {
      siteName: SITE_NAME, siteUrl: SITE_URL, recipient: d.email, confirmationUrl: url,
    }), { plainText: true })
    await sendLovableEmail(
      {
        to: d.email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: 'Confirmez votre adresse email',
        html,
        text,
        purpose: 'transactional',
        label: 'auth_signup',
        idempotency_key: `signup-${link.user?.id ?? d.email}`,
      },
      { apiKey: Deno.env.get('LOVABLE_API_KEY')!, sendUrl: Deno.env.get('LOVABLE_SEND_URL') },
    )
  } catch (e) {
    console.error('signup email failed', e instanceof Error ? e.message : String(e))
    return json({ error: "Compte créé, mais l'email de confirmation n'a pas pu partir. Contactez contact@lesnoces.net." }, 502)
  }

  return json({ success: true })
})
