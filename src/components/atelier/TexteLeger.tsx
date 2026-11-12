import { Fragment } from "react";

/** Markdown léger de l'assistant : gras et listes uniquement. */
function enligne(t: string) {
  return t.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>,
  );
}

export default function TexteLeger({ texte }: { texte: string }) {
  const blocs: JSX.Element[] = [];
  let liste: { ordonnee: boolean; items: string[] } | null = null;
  const vider = () => {
    if (!liste) return;
    const L = liste.ordonnee ? "ol" : "ul";
    blocs.push(
      <L key={blocs.length} className={liste.ordonnee ? "list-decimal pl-5 space-y-1" : "list-disc pl-5 space-y-1"}>
        {liste.items.map((it, i) => <li key={i}>{enligne(it)}</li>)}
      </L>,
    );
    liste = null;
  };
  for (const ligne of texte.split("\n")) {
    const puce = ligne.match(/^\s*[-*•]\s+(.*)$/);
    const num = ligne.match(/^\s*\d+[.)]\s+(.*)$/);
    if (puce || num) {
      const ordonnee = !!num;
      if (liste && liste.ordonnee !== ordonnee) vider();
      liste ??= { ordonnee, items: [] };
      liste.items.push((puce ?? num)![1]);
      continue;
    }
    vider();
    if (ligne.trim()) blocs.push(<p key={blocs.length}>{enligne(ligne)}</p>);
  }
  vider();
  return <div className="space-y-2">{blocs}</div>;
}
