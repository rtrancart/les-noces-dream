import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AuthLayout from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, ArrowLeft } from "lucide-react";

const MotDePasseOublie = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Email envoyé" subtitle="Vérifiez votre boîte mail">
        <div className="rounded-lg border border-border bg-card p-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed">
            Si un compte existe avec l'adresse <strong className="text-foreground">{email}</strong>,
            vous recevrez un lien pour réinitialiser votre mot de passe.
          </p>
          <Link to="/connexion">
            <Button variant="outline" className="font-sans mt-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Retour à la connexion
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Mot de passe oublié" subtitle="Nous vous enverrons un lien de réinitialisation">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="reset-email" className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Adresse email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reset-email"
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="pl-10 font-sans"
            />
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full font-sans font-semibold tracking-wide">
          {loading ? "Envoi…" : "Envoyer le lien"}
        </Button>
      </form>
      <div className="text-center">
        <Link to="/connexion" className="font-sans text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour à la connexion
        </Link>
      </div>
    </AuthLayout>
  );
};

export default MotDePasseOublie;
