import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AuthLayout from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Mail, Lock, Sparkles } from "lucide-react";

const Connexion = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicEmail, setMagicEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials"
        ? "Email ou mot de passe incorrect."
        : error.message);
    } else {
      toast.success("Connexion réussie !");
      navigate(from, { replace: true });
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Un lien de connexion vous a été envoyé par email.");
    }
  };

  return (
    <AuthLayout title="Se connecter" subtitle="Accédez à votre espace personnel">
      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
          <TabsTrigger value="email" className="font-sans text-xs">
            <Lock className="mr-1.5 h-3.5 w-3.5" /> Email & mot de passe
          </TabsTrigger>
          <TabsTrigger value="magic" className="font-sans text-xs">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Lien magique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <form onSubmit={handleEmailLogin} className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Adresse email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Mot de passe
                </Label>
                <Link
                  to="/mot-de-passe-oublie"
                  className="font-sans text-xs text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pl-10 font-sans"
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full font-sans font-semibold tracking-wide">
              {loading ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="magic">
          <form onSubmit={handleMagicLink} className="space-y-5 pt-4">
            <p className="font-sans text-sm text-muted-foreground leading-relaxed">
              Recevez un lien de connexion directement dans votre boîte mail — aucun mot de passe requis.
            </p>
            <div className="space-y-2">
              <Label htmlFor="magic-email" className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Adresse email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="magic-email"
                  type="email"
                  placeholder="vous@exemple.com"
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                  required
                  className="pl-10 font-sans"
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full font-sans font-semibold tracking-wide">
              {loading ? "Envoi…" : "Envoyer le lien magique"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      <p className="text-center font-sans text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link to="/inscription" className="font-medium text-primary hover:underline">
          Créer un compte
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Connexion;
