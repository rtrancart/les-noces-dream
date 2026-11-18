/** Snapshots keep their CSS even when a publication removes hashed assets. */
export function resolveCssUrls(css: string, cssUrl: string): string {
  const absolute = (value: string) => {
    if (/^(data:|blob:|#)/i.test(value)) return value;
    return new URL(value, cssUrl).href;
  };
  return css
    .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_all, _quote, value) => `url("${absolute(value.trim())}")`)
    .replace(/(@import\s+)(['"])([^'"]+)\2/gi, (_all, prefix, _quote, value) => `${prefix}"${absolute(value)}"`);
}

export function isCssResponse(response: Response): boolean {
  return response.ok && /^text\/css(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "");
}

function attribute(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2];
}

function localStyles(html: string, siteUrl: string) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].flatMap(([tag]) => {
    const href = attribute(tag, "href");
    if (!href || !attribute(tag, "rel")?.split(/\s+/).includes("stylesheet")) return [];
    const url = new URL(href.replace(/&amp;/g, "&"), siteUrl);
    if (url.origin !== new URL(siteUrl).origin || !url.pathname.startsWith("/assets/")) return [];
    return [{ tag, url: url.href, media: attribute(tag, "media") }];
  });
}

/** Only missing main-bundle CSS may fall back to the current main bundle. */
export async function preserveSnapshotStyles(
  html: string,
  siteUrl: string,
  fetchResource: typeof fetch = fetch,
): Promise<string> {
  let currentHtml: Promise<string> | undefined;
  for (const sheet of localStyles(html, siteUrl)) {
    let cssUrl = sheet.url;
    let response = await fetchResource(cssUrl, { signal: AbortSignal.timeout(8000) });
    if (!isCssResponse(response)) {
      if (!/\/assets\/index-[^/]+\.css$/.test(new URL(cssUrl).pathname)) {
        throw new Error("Snapshot stylesheet unavailable");
      }
      currentHtml ??= fetchResource(`${siteUrl.replace(/\/$/, "")}/index.html`, {
        signal: AbortSignal.timeout(8000),
      }).then(async (shell) => {
        if (!shell.ok) throw new Error("Current application unavailable");
        return shell.text();
      });
      const replacement = localStyles(await currentHtml, siteUrl).find((item) =>
        /\/assets\/index-[^/]+\.css$/.test(new URL(item.url).pathname)
      );
      if (!replacement) throw new Error("Current stylesheet missing");
      cssUrl = replacement.url;
      response = await fetchResource(cssUrl, { signal: AbortSignal.timeout(8000) });
    }
    if (!isCssResponse(response)) throw new Error("Snapshot stylesheet is not CSS");
    const css = await response.text();
    if (!css.trim()) throw new Error("Snapshot stylesheet empty");
    const resolved = resolveCssUrls(css, cssUrl).replace(/<\/style/gi, "<\\/style");
    const media = sheet.media ? ` media="${sheet.media.replace(/"/g, "&quot;")}"` : "";
    html = html.replace(sheet.tag, `<style data-prerender-css="preserved"${media}>${resolved}</style>`);
  }
  return html;
}