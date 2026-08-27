// Détection robot / humain — source de vérité unique du dépôt.
//
// PRINCIPE : « dans le doute, servir le snapshot ». Un humain qui reçoit par
// erreur un snapshot HTML statique n'a pas de conséquence grave ; un robot qui
// reçoit la coquille SPA vide fait perdre l'indexation. Le filet est donc large.

/** Agents explicitement prioritaires (moteurs, IA, aperçus sociaux). */
export const AGENTS_ROBOTS: string[] = [
  // Moteurs de recherche classiques
  "googlebot",
  "google-inspectiontool",
  "storebot-google",
  "bingbot",
  "bingpreview",
  "duckduckbot",
  "yandex",
  "baiduspider",
  "applebot",
  "qwantify",
  "seznambot",
  "sogou",
  "exabot",
  "naver",
  "petalbot",
  // Robots d'IA / réponses génératives
  "gptbot",
  "oai-searchbot",
  "chatgpt-user",
  "perplexitybot",
  "perplexity-user",
  "claudebot",
  "anthropic-ai",
  "claude-web",
  "claude-searchbot",
  "google-extended",
  "bytespider",
  "amazonbot",
  "meta-externalagent",
  "meta-externalfetcher",
  "facebookbot",
  "ccbot",
  "cohere-ai",
  "youbot",
  "diffbot",
  "applebot-extended",
  "mistralai-user",
  "timpibot",
  "omgili",
  "img2dataset",
  // Aperçus sociaux / messageries
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "slack-imgproxy",
  "whatsapp",
  "discordbot",
  "telegrambot",
  "pinterest",
  "redditbot",
  "embedly",
  "quora link preview",
  "vkshare",
  "skypeuripreview",
  // Outils d'audit SEO fréquents
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "screaming frog",
  "lighthouse",
  "chrome-lighthouse",
];

/** Filet large : tout agent qui « sent » le robot. */
const MOTIFS_LARGES = [
  "bot",
  "crawl",
  "spider",
  "slurp",
  "fetch",
  "preview",
  "search",
  "scrape",
  "archiver",
  "monitor",
  "validator",
  "http-client",
  "python-requests",
  "curl/",
  "wget",
  "headlesschrome",
];

/**
 * Vrai si la requête doit être servie depuis un snapshot pré-rendu.
 * Un `user-agent` absent ou vide est traité comme un robot (dans le doute).
 */
export function estRobot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim().toLowerCase();
  if (!ua) return true;
  if (AGENTS_ROBOTS.some((a) => ua.includes(a))) return true;
  return MOTIFS_LARGES.some((m) => ua.includes(m));
}

/**
 * Chemin de stockage déduit d'un chemin d'URL — doit rester strictement
 * identique à la règle utilisée par `prerender-snapshots-batch`.
 * `/` → `pages/index.html`, `/blog/mon-article` → `pages/blog/mon-article.html`.
 */
export function cheminStockageDepuisUrl(urlPath: string): string {
  const clean = urlPath.replace(/^\/+/, "").replace(/\/$/, "index");
  return `pages/${clean || "index"}.html`;
}
