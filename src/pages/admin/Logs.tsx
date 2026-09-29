import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface LogRow {
  id: string;
  admin_id: string;
  action: string;
  entite: string | null;
  entite_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  admin_email?: string;
  admin_name?: string;
}

const actionLabels: Record<string, string> = {
  create_user: "Création utilisateur",
  delete_user: "Suppression utilisateur",
  update_user: "Modification utilisateur",
  update_password: "Changement mot de passe",
  impersonate: "Impersonation",
  create_prestataire: "Création prestataire",
  update_prestataire: "Modification prestataire",
  delete_prestataire: "Suppression prestataire",
  update_statut_prestataire: "Changement statut prestataire",
  update_roles: "Modification rôles",
};

const actionColors: Record<string, string> = {
  create_user: "bg-sauge/20 text-sauge",
  delete_user: "bg-destructive/10 text-destructive",
  update_user: "bg-champagne/30 text-foreground",
  update_password: "bg-champagne/30 text-foreground",
  impersonate: "bg-bleu-petrole/10 text-bleu-petrole",
  create_prestataire: "bg-sauge/20 text-sauge",
  update_prestataire: "bg-champagne/30 text-foreground",
  delete_prestataire: "bg-destructive/10 text-destructive",
  update_statut_prestataire: "bg-champagne/30 text-foreground",
  update_roles: "bg-bleu-petrole/10 text-bleu-petrole",
};

const PAGE_SIZE = 50;

export default function Logs() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filterAction, setFilterAction] = useState("toutes");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState<string[]>(Object.keys(actionLabels));

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(0); }, [debounced, filterAction]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from("logs_admin")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filterAction !== "toutes") query = query.eq("action", filterAction);

    // Recherche côté serveur : action, entité, identifiant, ou email/nom de l'admin
    if (debounced) {
      const s = debounced.replace(/[%,()]/g, " ");
      const { data: matchProfiles } = await supabase
        .from("profiles")
        .select("id")
        .or(`email.ilike.%${s}%,nom.ilike.%${s}%,prenom.ilike.%${s}%`)
        .limit(100);
      const ors = [`action.ilike.%${s}%`, `entite.ilike.%${s}%`];
      if (/^[0-9a-f-]{36}$/i.test(s)) ors.push(`entite_id.eq.${s}`);
      const pids = (matchProfiles ?? []).map((p) => p.id);
      if (pids.length) ors.push(`admin_id.in.(${pids.join(",")})`);
      query = query.or(ors.join(","));
    }

    const { data, error, count } = await query;
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    setTotal(count ?? 0);

    const adminIds = [...new Set((data ?? []).map((l) => l.admin_id))];
    const { data: profiles } = adminIds.length
      ? await supabase.from("profiles").select("id, email, prenom, nom").in("id", adminIds)
      : { data: [] as { id: string; email: string; prenom: string | null; nom: string | null }[] };

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, { email: p.email, name: `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() }])
    );

    const enriched: LogRow[] = (data ?? []).map((l) => ({
      ...l,
      details: l.details as Record<string, unknown> | null,
      admin_email: profileMap.get(l.admin_id)?.email ?? "—",
      admin_name: profileMap.get(l.admin_id)?.name ?? "",
    }));

    setLogs(enriched);
    setActions((prev) => [...new Set([...prev, ...enriched.map((l) => l.action)])]);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [filterAction, debounced, page]);

  const filtered = logs;
  const uniqueActions = actions;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-foreground">Journal d'activité</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          Historique des actions administratives ({total} entrées)
        </p>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher dans les logs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 font-sans text-sm"
              />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[220px] font-sans text-sm">
                <SelectValue placeholder="Filtrer par action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les actions</SelectItem>
                {uniqueActions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {actionLabels[a] ?? a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans text-xs">Date</TableHead>
                <TableHead className="font-sans text-xs">Admin</TableHead>
                <TableHead className="font-sans text-xs">Action</TableHead>
                <TableHead className="font-sans text-xs">Entité</TableHead>
                <TableHead className="font-sans text-xs">Détails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-20 animate-pulse rounded bg-muted/30" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center font-sans text-sm text-muted-foreground py-8">
                    Aucun log trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-sans text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell className="font-sans text-sm">
                      <div>
                        <span className="font-medium">{log.admin_name || "—"}</span>
                        <p className="text-xs text-muted-foreground">{log.admin_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${actionColors[log.action] ?? "bg-muted/40 text-muted-foreground"} font-sans text-[11px] font-normal`}>
                        {actionLabels[log.action] ?? log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-sans text-xs text-muted-foreground">
                      {log.entite ? (
                        <span>
                          {log.entite}
                          {log.entite_id && (
                            <span className="ml-1 font-mono text-[10px] opacity-50">
                              {log.entite_id.substring(0, 8)}…
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="font-sans text-xs text-muted-foreground max-w-[250px] truncate">
                      {log.details ? (
                        <span title={JSON.stringify(log.details, null, 2)}>
                          {Object.entries(log.details)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 font-sans text-xs text-muted-foreground">
            <span>Page {page + 1} / {pageCount}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= pageCount || loading} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
