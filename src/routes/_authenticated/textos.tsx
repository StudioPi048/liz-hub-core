import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Copy, Plus, Search, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";

const VARIANTS = ["longa", "media", "curta", "instagram", "whatsapp", "email"] as const;
const VARIANT_LABEL: Record<(typeof VARIANTS)[number], string> = {
  longa: "Longa",
  media: "Média",
  curta: "Curta",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  email: "E-mail",
};

type TextSnippet = Tables<"text_snippets"> & {
  text_snippet_variants: Tables<"text_snippet_variants">[];
};

export const Route = createFileRoute("/_authenticated/textos")({
  component: TextosPage,
});

function TextosPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [bodies, setBodies] = useState<Record<string, string>>({});

  const snippets = useQuery({
    queryKey: ["snippets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("text_snippets")
        .select("*, text_snippet_variants(*)")
        .order("created_at", { ascending: false });
      if (error) throw new Error("Não foi possível carregar a biblioteca de textos.");
      return (data ?? []) as TextSnippet[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: snip, error } = await supabase
        .from("text_snippets")
        .insert({ title, theme: theme || null })
        .select()
        .single();
      if (error) throw error;
      const rows = Object.entries(bodies)
        .filter(([, v]) => v.trim())
        .map(([variant, body]) => ({ snippet_id: snip.id, variant, body }));
      if (rows.length) {
        const { error: e2 } = await supabase.from("text_snippet_variants").insert(rows);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success("Texto salvo");
      setOpen(false);
      setTitle("");
      setTheme("");
      setBodies({});
      qc.invalidateQueries({ queryKey: ["snippets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("text_snippets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["snippets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (snippets.data || []).filter(
    (s) =>
      !q ||
      s.title.toLowerCase().includes(q.toLowerCase()) ||
      (s.theme || "").toLowerCase().includes(q.toLowerCase()) ||
      (s.text_snippet_variants || []).some((v) => v.body.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div>
          <h1 className="text-2xl font-editorial tracking-tight">Biblioteca de Textos</h1>
          <p className="text-sm text-muted-foreground">Textos prontos com variações por canal.</p>
        </div>
        <div className="flex gap-2 flex-1 md:flex-none md:w-96">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Novo texto</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                <div>
                  <Label>Título</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <Label>Tema/Projeto</Label>
                  <Input
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="Ex: Congresso, Formação..."
                  />
                </div>
                {VARIANTS.map((v) => (
                  <div key={v}>
                    <Label>{VARIANT_LABEL[v]}</Label>
                    <Textarea
                      rows={3}
                      value={bodies[v] || ""}
                      onChange={(e) => setBodies({ ...bodies, [v]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!title}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {snippets.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : snippets.isError ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-card py-16 text-center">
          <AlertTriangle className="h-6 w-6 text-[var(--semantic-critical-fg)]" />
          <p className="font-medium">Não foi possível carregar a biblioteca de textos.</p>
          <p className="text-sm text-muted-foreground max-w-sm">Tente novamente em instantes.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">
          {snippets.data && snippets.data.length > 0
            ? "Nenhum texto encontrado para esta busca."
            : "Nenhum texto ainda. Cadastre o primeiro texto pronto do Instituto."}
        </p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((s) => (
            <Card key={s.id}>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  {s.theme && (
                    <Badge variant="secondary" className="mt-1">
                      {s.theme}
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Remover?")) del.mutate(s.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {(s.text_snippet_variants || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem variações.</p>
                )}
                {(s.text_snippet_variants || []).map((v) => (
                  <div key={v.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline">
                        {VARIANT_LABEL[v.variant as (typeof VARIANTS)[number]] ?? v.variant}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(v.body);
                          toast.success("Copiado");
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar
                      </Button>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{v.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
