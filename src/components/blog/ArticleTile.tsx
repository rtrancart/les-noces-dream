import { Link } from "react-router-dom";

interface ArticleTileProps {
  article: {
    slug: string;
    titre: string;
    extrait?: string | null;
    categorie_blog?: string | null;
    image_couverture_url?: string | null;
    publie_le?: string | null;
    auteur?: string | null;
    reading?: number;
  };
  size?: "compact" | "default" | "large";
}

const tonePalettes = [
  ["#EADBCE", "#D3BCA8"],
  ["#E4D2A8", "#BFA66C"],
  ["#B3BBA6", "#7F8A74"],
  ["#A86E6B", "#7A3F3E"],
  ["#C89852", "#8E6A1E"],
];

function hashTone(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return tonePalettes[h % tonePalettes.length];
}

export function ArticleTile({ article, size = "default" }: ArticleTileProps) {
  const h = size === "compact" ? "h-80" : size === "large" ? "h-[420px]" : "h-[420px]";
  const titleSize = size === "compact" ? "text-2xl" : "text-3xl md:text-[2rem]";
  const [a, b] = hashTone(article.slug);

  return (
    <article className="group">
      <Link to={`/blog/${article.slug}`} className="block">
        <div className={`w-full ${h} relative overflow-hidden`}>
          {article.image_couverture_url ? (
            <img
              src={article.image_couverture_url}
              alt={article.titre}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: `linear-gradient(140deg, ${a} 0%, ${b} 100%)` }}
              aria-hidden
            />
          )}
        </div>
        <div className="pt-7">
          {article.categorie_blog && (
            <div className="flex items-center gap-3 mb-4 text-[10px] tracking-[0.2em] uppercase text-gris-cachemire">
              <span className="w-[18px] h-px bg-or-riche" />
              <span>{article.categorie_blog}</span>
            </div>
          )}
          <h3
            className={`font-serif font-normal ${titleSize} leading-tight tracking-tight text-bleu-abysse`}
          >
            {article.titre}
          </h3>
          {size !== "compact" && article.extrait && (
            <p className="font-serif text-[15px] leading-relaxed text-gris-cachemire mt-4 line-clamp-2">
              {article.extrait}
            </p>
          )}
          <div className="mt-5 text-[10px] tracking-[0.2em] uppercase text-gris-cachemire">
            {article.auteur && <>{article.auteur} &nbsp;·&nbsp; </>}
            {article.reading ?? 5} min
          </div>
        </div>
      </Link>
    </article>
  );
}
