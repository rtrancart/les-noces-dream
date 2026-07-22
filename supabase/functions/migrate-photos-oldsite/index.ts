import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = "https://www.lesnoces.net/data/prestataire/";
const BUCKET = "prestataires-photos";

interface FicheInput {
  id: string;
  main: string;
  gallery: string[];
}

const FICHES: FicheInput[] = [
  {
    id: "0598e467-7955-4ad3-849c-f6859a5bd86a",
    main: "chateau-l-escale-1-4bqvs.jpg",
    gallery: ["chateau-l-escale-2-uneh0.jpg", "chateau-l-escale-2-af61n.jpg", "chateau-l-escale-3-il3qk.jpg", "chateau-l-escale-4-l1fnm.jpg"],
  },
  {
    id: "0218c178-6966-4f3e-bb91-79b3ead47d6b",
    main: "aes-1-flsmw.jpg",
    gallery: ["aes-1-pa1ak.jpg", "aes-2-0r5se.jpg", "aes-3-qwm9a.jpg", "aes-4-naaa2.jpg"],
  },
  {
    id: "008466d0-cade-4bc1-add5-00cf80777a72",
    main: "lu-1-ncfeu.jpg",
    gallery: ["lu-1-3f136.jpg", "lu-2-ja2n6.jpg", "lu-3-u83xm.jpg", "lu-4-mbjxb.jpg"],
  },
  {
    id: "002b98dc-bfe7-485f-8451-2c8ffdd95f7e",
    main: "coeur-2tt1i.jpg",
    gallery: [],
  },
  {
    id: "02b90a38-aeda-44a6-9b28-802f8bfde4f5",
    main: "bou-nkrpg.jpg",
    gallery: [],
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const report: any[] = [];

  for (const fiche of FICHES) {
    const ficheReport = { id: fiche.id, main: null as any, gallery: [] as any[] };

    const uploadOne = async (filename: string) => {
      const url = BASE + filename;
      try {
        const r = await fetch(url);
        if (!r.ok) return { filename, ok: false, error: `HTTP ${r.status}` };
        const bytes = new Uint8Array(await r.arrayBuffer());
        const ext = filename.split(".").pop() || "jpg";
        const path = `${fiche.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const contentType = r.headers.get("content-type") || `image/${ext === "jpg" ? "jpeg" : ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
          contentType,
          upsert: false,
        });
        if (error) return { filename, ok: false, error: error.message };
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return { filename, ok: true, publicUrl: data.publicUrl, path };
      } catch (e: any) {
        return { filename, ok: false, error: e.message };
      }
    };

    const mainRes = await uploadOne(fiche.main);
    ficheReport.main = mainRes;

    for (const g of fiche.gallery) {
      const res = await uploadOne(g);
      ficheReport.gallery.push(res);
    }

    const mainUrl = mainRes.ok ? mainRes.publicUrl : null;
    const galleryUrls = ficheReport.gallery.filter((x) => x.ok).map((x) => x.publicUrl);

    const update: any = { urls_galerie: galleryUrls };
    if (mainUrl) update.photo_principale_url = mainUrl;

    const { error: upErr } = await supabase.from("prestataires").update(update).eq("id", fiche.id);
    (ficheReport as any).dbUpdate = upErr ? { ok: false, error: upErr.message } : { ok: true };

    report.push(ficheReport);
  }

  return new Response(JSON.stringify({ report }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
