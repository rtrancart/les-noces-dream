import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AuthLayout from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Mail, Lock, User, Heart, Briefcase } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const Inscription = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState<"client" | "prestataire">("client");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          prenom,
          nom,
          role_souhaite: role,
        },
      },
    });

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      trackEvent("inscription", { role });
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <AuthLayout title="Vérifiez votre email" subtitle="Un lien de confirmation vous a été envoyé">
        <div className="rounded-lg border border-border bg-card p-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed">
            Nous avons envoyé un email de vérification à <strong className="text-foreground">{email}</strong>.
            Cliquez sur le lien dans l'email pour activer votre compte.
          </p>
          <Link to="/connexion">
            <Button variant="outline" className="font-sans mt-2">
              Retour à la connexion
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Créer un compte" subtitle="Rejoignez la communauté LesNoces">
      <form onSubmit={handleSignup} className="space-y-5">
        {/* Role selector */}
        <div className="space-y-3">
          <Label className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Vous êtes
          </Label>
          <RadioGroup
            value={role}
            onValueChange={(v) => setRole(v as "client" | "prestataire")}
            className="grid grid-cols-2 gap-3"
          >
            <label
              htmlFor="role-client"
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-all ${
                role === "client"
                  ? "border-primary bg-primary/5 shadow-soft"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <RadioGroupItem value="client" id="role-client" />
              <div>
                <div className="flex items-center gap-1.5">
                  <Heart className="h-4 w-4 text-primary" />
                  <span className="font-sans text-sm font-semibold text-foreground">Futur·e marié·e</span>
                </div>
                <p className="font-sans text-xs text-muted-foreground mt-0.5">Je cherche un prestataire</p>
              </div>
            </label>
            <label
              htmlFor="role-prestataire"
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-all ${
                role === "prestataire"
                  ? "border-primary bg-primary/5 shadow-soft"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <RadioGroupItem value="prestataire" id="role-prestataire" />
              <div>
                <div className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <span className="font-sans text-sm font-semibold text-foreground">Prestataire</span>
                </div>
                <p className="font-sans text-xs text-muted-foreground mt-0.5">Je propose mes services</p>
              </div>
            </label>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="prenom" className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Prénom
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="prenom"
                placeholder="Marie"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                required
                className="pl-10 font-sans"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nom" className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Nom
            </Label>
            <Input
              id="nom"
              placeholder="Dupont"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              className="font-sans"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-email" className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Adresse email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-email"
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="pl-10 font-sans"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password" className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Mot de passe
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="signup-password"
              type="password"
              placeholder="Minimum 6 caractères"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="pl-10 font-sans"
            />
          </div>
        </div>

        <Button type="submit" disabled={loading} className="w-full font-sans font-semibold tracking-wide">
          {loading ? "Création…" : "Créer mon compte"}
        </Button>
      </form>

      <p className="text-center font-sans text-sm text-muted-foreground">
        Déjà inscrit ?{" "}
        <Link to="/connexion" className="font-medium text-primary hover:underline">
          Se connecter
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Inscription;
