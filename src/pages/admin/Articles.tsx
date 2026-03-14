import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Article = Database["public"]["Tables"]["articles_blog"]["Row"];

export default function Articles() {
  const [data, setData] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: result, error } = await supabase
        .from("articles_blog")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      else setData(result ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-foreground">Articles de blog</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">Gérez le contenu éditorial</p>
      </div>
      <Card className="shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs">Titre</TableHead>
                <TableHead className="font-sans text-xs">Catégorie</TableHead>
                <TableHead className="font-sans text-xs">Publié</TableHead>
                <TableHead className="font-sans text-xs">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted/30" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center font-sans text-sm text-muted-foreground py-8">
                    Aucun article
                  </TableCell>
                </TableRow>
              ) : (
                data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-sans text-sm font-medium">{a.titre}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{a.categorie_blog ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={a.est_publie ? "bg-sauge/20 text-sauge" : "bg-muted text-muted-foreground"}>
                        {a.est_publie ? "Oui" : "Non"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-sans text-xs text-muted-foreground">
                      {format(new Date(a.created_at), "dd MMM yyyy", { locale: fr })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
