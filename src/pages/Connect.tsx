import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import SeoHead from "@/components/SeoHead";

const mcpUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mcp`;

function UrlCard() {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    await navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="rounded-xl border border-primary/30 bg-card p-5 shadow-soft">
      <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground mb-2">
        URL du serveur MCP LesNoces
      </p>
      <div className="flex items-center gap-3">
        <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-sm text-foreground">
          {mcpUrl}
        </code>
        <Button onClick={onCopy} variant="outline" className="font-sans shrink-0">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">{copied ? "Copié" : "Copier"}</span>
        </Button>
      </div>
    </div>
  );
}

function StepList({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal pl-5 space-y-2 font-sans text-sm text-foreground/90 leading-relaxed">{children}</ol>;
}

export default function Connect() {
  return (
    <>
      <SeoHead
        title="Connecter un assistant IA à LesNoces"
        description="Instructions pour connecter ChatGPT ou Claude au serveur MCP LesNoces via OAuth."
        canonicalUrl="/connect"
      />
      <main className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="font-sans text-xs uppercase tracking-wider text-primary">
              Intégration assistants IA
            </span>
          </div>
          <h1 className="font-serif text-4xl text-foreground">
            Connecter un assistant IA à LesNoces
          </h1>
          <p className="font-sans text-base text-muted-foreground leading-relaxed">
            Reliez ChatGPT ou Claude à votre compte LesNoces pour rechercher des prestataires,
            consulter vos demandes de devis et interroger vos données depuis votre assistant préféré.
            La connexion se fait par OAuth : vous vous authentifiez avec votre compte habituel,
            aucune clé technique à copier.
          </p>
        </header>

        <UrlCard />

        <section className="space-y-4">
          <h2 className="font-serif text-2xl text-foreground">Connecter ChatGPT</h2>
          <StepList>
            <li>
              Ouvrez{" "}
              <a
                href="https://chatgpt.com/#settings/Connectors/Advanced"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                les réglages Connecteurs de ChatGPT <ExternalLink className="h-3 w-3" />
              </a>{" "}
              et activez le <strong>Mode développeur</strong> (lisez l'avertissement de risque affiché).
            </li>
            <li>Dans le composeur de chat, ouvrez le menu <strong>« + »</strong> et activez le mode développeur.</li>
            <li>Cliquez sur <strong>« Ajouter des sources »</strong>, puis <strong>« Connecter »</strong>.</li>
            <li>Nommez le connecteur (ex. LesNoces) et collez l'URL du serveur MCP ci-dessus.</li>
            <li>Autorisez la connexion sur l'écran de consentement LesNoces, puis demandez à ChatGPT d'utiliser l'app.</li>
          </StepList>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-2xl text-foreground">Connecter Claude</h2>
          <StepList>
            <li>
              Ouvrez{" "}
              <a
                href="https://claude.ai/customize/connectors?modal=add-custom-connector"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                la page Connecteurs de Claude <ExternalLink className="h-3 w-3" />
              </a>
              .
            </li>
            <li>Nommez le connecteur (ex. LesNoces) et collez l'URL du serveur MCP ci-dessus.</li>
            <li>Autorisez la connexion sur l'écran de consentement LesNoces.</li>
            <li>Activez le connecteur depuis le composeur de chat, puis demandez à Claude d'utiliser l'app.</li>
          </StepList>
        </section>

        <section className="space-y-4 border-t border-border pt-10">
          <h2 className="font-serif text-2xl text-foreground">Rafraîchir après une mise à jour</h2>
          <p className="font-sans text-sm text-muted-foreground">
            Les assistants gardent en cache la liste des outils. Après une évolution de LesNoces,
            actualisez le connecteur pour récupérer la dernière version.
          </p>

          <div>
            <h3 className="font-serif text-lg text-foreground mb-2">ChatGPT</h3>
            <StepList>
              <li>Ouvrez les préférences d'app de ChatGPT et sélectionnez LesNoces dans « Apps activées ».</li>
              <li>À côté de « Informations », cliquez sur <strong>« Actualiser »</strong>.</li>
              <li>Si l'URL a changé, collez la nouvelle URL ci-dessus.</li>
              <li>Lancez un nouveau chat et demandez à ChatGPT d'utiliser LesNoces.</li>
            </StepList>
          </div>

          <div>
            <h3 className="font-serif text-lg text-foreground mb-2">Claude</h3>
            <StepList>
              <li>Ouvrez la page Connecteurs et sélectionnez LesNoces.</li>
              <li>Actualisez ou mettez à jour les outils du connecteur.</li>
              <li>Si l'URL a changé, collez la nouvelle URL ci-dessus.</li>
              <li>Demandez à Claude d'utiliser LesNoces.</li>
            </StepList>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-muted/40 p-5">
          <p className="font-sans text-sm text-foreground/90">
            L'assistant agit en votre nom et respecte vos droits d'accès (RLS) :
            un client voit ses demandes envoyées, un prestataire celles reçues.
            Les recherches de prestataires et catégories restent publiques.
          </p>
          <p className="font-sans text-xs text-muted-foreground mt-3">
            Besoin d'aide ?{" "}
            <Link to="/contact" className="text-primary hover:underline">
              Contactez-nous
            </Link>
            .
          </p>
        </section>
      </main>
    </>
  );
}
