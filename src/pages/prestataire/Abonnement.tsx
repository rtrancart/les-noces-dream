import { CreditCard, Check, X, AlertCircle } from "lucide-react";

export default function PrestataireAbonnement() {
  return (
    <div className="space-y-8">
      {/* Alert Banner */}
      <div className="bg-destructive/10 border-l-4 border-destructive rounded-lg p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-destructive flex-shrink-0 mt-0.5" size={22} />
          <div>
            <h3 className="font-serif text-lg text-foreground mb-1">
              Aucun abonnement actif
            </h3>
            <p className="font-sans text-sm text-muted-foreground">
              Souscrivez à un abonnement pour apparaître sur LesNoces.net et recevoir des demandes de devis
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Plans */}
      <div>
        <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-1 text-center">
          Choisissez votre formule
        </h2>
        <p className="font-sans text-sm text-muted-foreground mb-8 text-center">
          Sélectionnez l'offre qui correspond le mieux à vos besoins
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Essentiel */}
          <div className="bg-card border-2 border-border rounded-xl p-6 hover:border-muted transition-all hover:shadow-md">
            <div className="text-center mb-5">
              <h3 className="font-serif text-xl text-foreground mb-1">Essentiel</h3>
              <div className="font-serif text-3xl text-foreground">49€</div>
              <p className="font-sans text-xs text-muted-foreground">par mois</p>
            </div>
            <ul className="space-y-2.5 mb-6">
              {[
                { included: true, text: "Profil professionnel complet" },
                { included: true, text: "Galerie jusqu'à 20 photos" },
                { included: true, text: "Réception de demandes de devis" },
                { included: true, text: "Statistiques basiques" },
                { included: false, text: "Badge premium" },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  {item.included ? (
                    <Check size={18} className="text-sauge flex-shrink-0 mt-0.5" />
                  ) : (
                    <X size={18} className="text-border flex-shrink-0 mt-0.5" />
                  )}
                  <span
                    className={`font-sans text-sm ${
                      item.included ? "text-foreground" : "text-muted-foreground line-through"
                    }`}
                  >
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
            <button className="w-full py-2.5 border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all rounded-lg font-sans font-semibold text-sm">
              Choisir Essentiel
            </button>
          </div>

          {/* Premium — Featured */}
          <div className="bg-gradient-to-br from-primary to-muted text-primary-foreground rounded-xl p-6 relative shadow-xl md:scale-105">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 py-1 rounded-full">
              <span className="font-sans text-xs font-bold uppercase tracking-wider">
                Recommandé
              </span>
            </div>
            <div className="text-center mb-5 mt-3">
              <h3 className="font-serif text-xl mb-1">Premium</h3>
              <div className="font-serif text-4xl">149€</div>
              <p className="font-sans text-xs text-primary-foreground/80">par mois</p>
            </div>
            <ul className="space-y-2.5 mb-6">
              {[
                "Tout de l'offre Essentiel",
                "Galerie photo illimitée",
                "Badge Premium visible",
                "Statistiques avancées",
                "Support prioritaire",
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check size={18} className="flex-shrink-0 mt-0.5" />
                  <span className="font-sans text-sm">{text}</span>
                </li>
              ))}
            </ul>
            <button className="w-full py-2.5 bg-card text-primary hover:bg-foreground hover:text-background transition-all rounded-lg font-sans font-bold text-sm">
              Choisir Premium
            </button>
          </div>

          {/* Élite */}
          <div className="bg-card border-2 border-border rounded-xl p-6 hover:border-muted transition-all hover:shadow-md">
            <div className="text-center mb-5">
              <h3 className="font-serif text-xl text-foreground mb-1">Élite</h3>
              <div className="font-serif text-3xl text-foreground">299€</div>
              <p className="font-sans text-xs text-muted-foreground">par mois</p>
            </div>
            <ul className="space-y-2.5 mb-6">
              {[
                "Tout de l'offre Premium",
                "Mise en avant en page d'accueil",
                "Positionnement prioritaire",
                "Newsletter mensuelle dédiée",
                "Accompagnement personnalisé",
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check size={18} className="text-sauge flex-shrink-0 mt-0.5" />
                  <span className="font-sans text-sm text-foreground">{text}</span>
                </li>
              ))}
            </ul>
            <button className="w-full py-2.5 border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all rounded-lg font-sans font-semibold text-sm">
              Choisir Élite
            </button>
          </div>
        </div>
      </div>

      {/* Payment info */}
      <div className="bg-background rounded-lg p-5 border border-border">
        <div className="flex items-start gap-3">
          <CreditCard className="text-primary flex-shrink-0" size={22} />
          <div>
            <h4 className="font-sans font-semibold text-foreground text-sm mb-1">
              Paiement sécurisé par Stripe
            </h4>
            <p className="font-sans text-xs text-muted-foreground mb-2">
              Vos informations de paiement sont protégées et cryptées. Aucun engagement, annulez à tout moment.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Check size={14} className="text-sauge" />
                <span className="font-sans">Sans engagement</span>
              </div>
              <div className="flex items-center gap-1">
                <Check size={14} className="text-sauge" />
                <span className="font-sans">Facturation mensuelle</span>
              </div>
              <div className="flex items-center gap-1">
                <Check size={14} className="text-sauge" />
                <span className="font-sans">Annulation simple</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
