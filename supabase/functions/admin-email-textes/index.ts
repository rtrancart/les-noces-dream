// admin-email-textes — Admin-only endpoint.
// action=list  → returns registry metadata + DB row per template
// action=reset → renders default HTML (with {{var}} placeholders) and upserts DB row
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { DESIGNED_TEMPLATES } from './build-designed-html.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function placeholderData(previewData: Record<string, any> | undefined) {
  const keys = previewData ? Object.keys(previewData) : []
  return Object.fromEntries(keys.map((k) => [k, `{{${k}}}`]))
}

async function buildDefault(templateName: string) {
  const entry = TEMPLATES[templateName]
  if (!entry) throw new Error(`Unknown template: ${templateName}`)
  const data = placeholderData(entry.previewData)
  const html = await renderAsync(React.createElement(entry.component, data))
  const subject =
    typeof entry.subject === 'function' ? entry.subject(data) : entry.subject
  return { html, subject, variables: Object.keys(entry.previewData ?? {}) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Non autorisé')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) throw new Error('Non autorisé')

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id)
    const roleList = (roles ?? []).map((r: any) => r.role)
    if (!roleList.includes('admin') && !roleList.includes('super_admin')) {
      throw new Error('Accès refusé : rôle admin requis')
    }

    const body = await req.json().catch(() => ({}))
    const action = body?.action as string | undefined

    if (action === 'list') {
      const { data: rows } = await admin.from('email_textes').select('*')
      const byName = new Map<string, any>((rows ?? []).map((r: any) => [r.template_name, r]))

      const items: any[] = []
      for (const name of Object.keys(TEMPLATES)) {
        const entry = TEMPLATES[name]
        const def = await buildDefault(name).catch((e) => ({
          html: '',
          subject: '',
          variables: Object.keys(entry.previewData ?? {}),
          error: e instanceof Error ? e.message : String(e),
        }))
        const dbRow = byName.get(name) ?? null
        const hasCustom =
          !!dbRow &&
          dbRow.est_actif &&
          typeof dbRow.sujet === 'string' && dbRow.sujet.trim().length > 0 &&
          typeof dbRow.corps_html === 'string' && dbRow.corps_html.trim().length > 0
        items.push({
          templateName: name,
          displayName: entry.displayName ?? name,
          variables: def.variables,
          defaultSubject: def.subject,
          defaultHtml: def.html,
          dbRow,
          source: hasCustom ? 'db' : 'code',
        })
      }
      return new Response(JSON.stringify({ items }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'reset') {
      const templateName = body?.templateName as string
      if (!templateName || !TEMPLATES[templateName]) {
        throw new Error('templateName invalide')
      }
      const entry = TEMPLATES[templateName]
      const def = await buildDefault(templateName)
      const { data, error } = await admin
        .from('email_textes')
        .upsert(
          {
            template_name: templateName,
            display_name: entry.displayName ?? templateName,
            sujet: def.subject,
            corps_html: def.html,
            est_actif: true,
            variables_disponibles: def.variables,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'template_name' }
        )
        .select()
        .single()
      if (error) throw error
      return new Response(JSON.stringify({ ok: true, row: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'seed_missing') {
      const { data: rows } = await admin.from('email_textes').select('template_name')
      const existing = new Set((rows ?? []).map((r: any) => r.template_name))
      const created: string[] = []
      for (const name of Object.keys(TEMPLATES)) {
        if (existing.has(name)) continue
        const entry = TEMPLATES[name]
        const def = await buildDefault(name)
        const { error } = await admin.from('email_textes').insert({
          template_name: name,
          display_name: entry.displayName ?? name,
          sujet: def.subject,
          corps_html: def.html,
          est_actif: true,
          variables_disponibles: def.variables,
        })
        if (!error) created.push(name)
      }
      return new Response(JSON.stringify({ ok: true, created }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error("action inconnue (list | reset | seed_missing)")
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
