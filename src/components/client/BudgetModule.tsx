import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Plus, Trash2, Euro } from "lucide-react";

interface BudgetLine {
  id: string;
  label: string;
  amount: number;
}

interface BudgetData {
  totalBudget: number;
  lines: BudgetLine[];
}

const DEFAULT_CATEGORIES = [
  "Lieu de réception",
  "Traiteur",
  "Photographe",
  "Vidéaste",
  "DJ / Musique",
  "Fleuriste",
  "Décoration",
  "Robe de mariée",
  "Costume",
  "Coiffure & Maquillage",
  "Faire-part & Papeterie",
  "Wedding Planner",
  "Officiant de cérémonie",
  "Voiture / Transport",
  "Animation",
  "Pâtissier / Wedding Cake",
];

interface BudgetModuleProps {
  className?: string;
}

export default function BudgetModule({ className }: BudgetModuleProps) {
  const { user } = useAuth();
  const [data, setData] = useState<BudgetData>({ totalBudget: 0, lines: [] });
  const [planId, setPlanId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLine, setEditLine] = useState<BudgetLine | null>(null);
  const [lineLabel, setLineLabel] = useState("");
  const [lineAmount, setLineAmount] = useState("");
  const [customLabel, setCustomLabel] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [totalInput, setTotalInput] = useState("");

  const persist = useCallback(
    async (next: BudgetData, existingPlanId: string | null) => {
      if (!user?.id) return;
      if (existingPlanId) {
        await supabase
          .from("planificateur")
          .update({ donnees: next as any, updated_at: new Date().toISOString() })
          .eq("id", existingPlanId);
      } else {
        const { data: inserted } = await supabase
          .from("planificateur")
          .insert({
            user_id: user.id,
            type: "budget" as any,
            donnees: next as any,
          })
          .select("id")
          .single();
        if (inserted) setPlanId(inserted.id);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("planificateur")
      .select("id, donnees")
      .eq("user_id", user.id)
      .eq("type", "budget")
      .limit(1)
      .single()
      .then(({ data: row }) => {
        if (row) {
          const d = row.donnees as any;
          setPlanId(row.id);
          setData({
            totalBudget: d?.totalBudget ?? 0,
            lines: d?.lines ?? [],
          });
        }
      });
  }, [user?.id]);

  const totalEngaged = data.lines.reduce((s, l) => s + l.amount, 0);

  const openAddLine = () => {
    setEditLine(null);
    setLineLabel("");
    setLineAmount("");
    setCustomLabel(false);
    setDialogOpen(true);
  };

  const openEditLine = (line: BudgetLine) => {
    setEditLine(line);
    const isDefault = DEFAULT_CATEGORIES.includes(line.label);
    setLineLabel(isDefault ? line.label : "__custom__");
    setCustomLabel(!isDefault);
    if (!isDefault) setLineLabel(line.label);
    setLineAmount(String(line.amount));
    setDialogOpen(true);
  };

  const saveLine = () => {
    const label = lineLabel.trim();
    const amount = parseInt(lineAmount) || 0;
    if (!label || amount <= 0) return;

    let next: BudgetData;
    if (editLine) {
      next = {
        ...data,
        lines: data.lines.map((l) =>
          l.id === editLine.id ? { ...l, label, amount } : l
        ),
      };
    } else {
      next = {
        ...data,
        lines: [
          ...data.lines,
          { id: crypto.randomUUID(), label, amount },
        ],
      };
    }
    setData(next);
    persist(next, planId);
    setDialogOpen(false);
  };

  const deleteLine = (id: string) => {
    const next = { ...data, lines: data.lines.filter((l) => l.id !== id) };
    setData(next);
    persist(next, planId);
  };

  const saveTotalBudget = () => {
    const total = parseInt(totalInput) || 0;
    const next = { ...data, totalBudget: total };
    setData(next);
    persist(next, planId);
    setBudgetDialogOpen(false);
  };

  const pct = data.totalBudget > 0 ? Math.min(100, Math.round((totalEngaged / data.totalBudget) * 100)) : 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-sans text-sm">Budget estimé</CardTitle>
          <button
            type="button"
            onClick={() => {
              setTotalInput(String(data.totalBudget || ""));
              setBudgetDialogOpen(true);
            }}
            className="font-sans text-xs text-primary hover:underline"
          >
            Modifier →
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        {data.totalBudget > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between font-sans text-xs text-muted-foreground">
              <span>{totalEngaged.toLocaleString("fr-FR")} € engagés</span>
              <span>{data.totalBudget.toLocaleString("fr-FR")} €</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="font-sans text-xs text-muted-foreground text-right">{pct}%</p>
          </div>
        )}

        {data.totalBudget === 0 && (
          <p className="font-sans text-xs text-muted-foreground text-center py-2">
            Définissez votre budget total pour commencer
          </p>
        )}

        {/* Lines */}
        {data.lines.length > 0 && (
          <div className="space-y-0 divide-y divide-border">
            {data.lines.map((line) => (
              <div key={line.id} className="flex items-center justify-between py-2.5 group">
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm text-foreground truncate">{line.label}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-sans text-sm font-medium text-foreground">
                    {line.amount.toLocaleString("fr-FR")} €
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditLine(line)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-opacity"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteLine(line.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total engaged */}
        {data.lines.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="font-sans text-sm font-medium text-foreground">Total engagé</span>
            <span className="font-sans text-sm font-semibold text-foreground">
              {totalEngaged.toLocaleString("fr-FR")} €
            </span>
          </div>
        )}

        <Button variant="outline" size="sm" className="w-full gap-2" onClick={openAddLine}>
          <Plus className="h-4 w-4" />
          Ajouter une ligne
        </Button>
      </CardContent>

      {/* Add/Edit line dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-sans">
              {editLine ? "Modifier la ligne" : "Ajouter une ligne budget"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-sans text-sm">Catégorie</Label>
              {!customLabel ? (
                <div className="space-y-2">
                  <Select
                    value={DEFAULT_CATEGORIES.includes(lineLabel) ? lineLabel : ""}
                    onValueChange={(v) => {
                      if (v === "__custom__") {
                        setCustomLabel(true);
                        setLineLabel("");
                      } else {
                        setLineLabel(v);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">✏️ Saisie libre…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    placeholder="Ex : Location de matériel"
                    value={lineLabel}
                    onChange={(e) => setLineLabel(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCustomLabel(false);
                      setLineLabel("");
                    }}
                    className="font-sans text-xs text-primary hover:underline"
                  >
                    ← Revenir à la liste
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-sans text-sm">Montant (€)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={lineAmount}
                  onChange={(e) => setLineAmount(e.target.value)}
                />
                <Euro className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveLine} disabled={!lineLabel.trim() || !(parseInt(lineAmount) > 0)}>
              {editLine ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Total budget dialog */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-sans">Budget total</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="font-sans text-sm">Montant total (€)</Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                placeholder="40 000"
                value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                autoFocus
              />
              <Euro className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBudgetDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveTotalBudget}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
