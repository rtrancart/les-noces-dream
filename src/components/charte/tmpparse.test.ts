// @vitest-environment jsdom
import { it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { parseCharte } from './CharteSignatureFlow';
it('parses active charte', async () => {
  const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);
  const { data } = await sb.from('chartes_versions').select('contenu_html').is('archivee_le', null).maybeSingle();
  const r = parseCharte((data as any).contenu_html);
  console.log(r.articles.length, r.articles.map(a=>`${a.num}|${a.titre}|${a.title}|${a.html.length}`));
  expect(r.articles.length).toBeGreaterThan(0);
}, 30000);
