import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type PageContenu = Database["public"]["Tables"]["pages_contenu"]["Row"];

export default function Pages() {
  const [data, setData] = useState<PageContenu[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: result, error } = await supabase
        .from("pages_contenu")
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
        <h1 className="text-2xl font-serif font-semibold text-foreground">Pages de contenu</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">Pages statiques de la plateforme</p>
      </div>
      <Card className="shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs">Titre</TableHead>
                <TableHead className="font-sans text-xs">Slug</TableHead>
                <TableHead className="font-sans text-xs">Publiée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 3 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted/30" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center font-sans text-sm text-muted-foreground py-8">
                    Aucune page
                  </TableCell>
                </TableRow>
              ) : (
                data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-sans text-sm font-medium">{p.titre}</TableCell>
                    <TableCell className="font-sans text-xs text-muted-foreground font-mono">/{p.slug}</TableCell>
                    <TableCell>
                      <Badge className={p.est_publiee ? "bg-sauge/20 text-sauge" : "bg-muted text-muted-foreground"}>
                        {p.est_publiee ? "Oui" : "Non"}
                      </Badge>
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
