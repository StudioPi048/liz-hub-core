import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Copy, ExternalLink, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/links")({
  component: LinksPage,
});

function LinksPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", category_id: "", notes: "" });

  const cats = useQuery({
    queryKey: ["link-categories"],
    queryFn: async () => (await supabase.from("link_categories").select("*").order("sort_order")).data || [],
  });
  const links = useQuery({
    queryKey: ["links"],
    queryFn: async () => (await supabase.from("links").select("*, link_categories(name, color)").order("name")).data || [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("links").insert({
        name: form.name, url: form.url,
        category_id: form.category_id || null, notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link adicionado");
      setOpenNew(false);
      setForm({ name: "", url: "", category_id: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["links"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("links").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["links"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = (links.data || []).filter((l: any) =>
    !q || l.name.toLowerCase().includes(q.toLowerCase()) || l.url.toLowerCase().includes(q.toLowerCase()),
  );

  const byCategory = new Map<string, any[]>();
  for (const l of filtered) {
    const key = l.link_categories?.name || "Sem categoria";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(l);
  }

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Biblioteca de Links</h1>
          <p className="text-sm text-muted-foreground">Todos os links do Instituto em um só lugar.</p>
        </div>
        <div className="flex gap-2 flex-1 md:flex-none md:w-96">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar link..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Novo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo link</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} /></div>
                <div><Label>URL</Label><Input value={form.url} onChange={(e)=>setForm({...form, url:e.target.value})} placeholder="https://..." /></div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category_id} onValueChange={(v)=>setForm({...form, category_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(cats.data || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})} /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!form.name || !form.url}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {[...byCategory.entries()].map(([cat, list]) => (
        <div key={cat}>
          <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider text-muted-foreground">{cat}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((l: any) => (
              <Card key={l.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{l.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{l.url}</div>
                      {l.notes && <div className="text-xs mt-1 text-muted-foreground">{l.notes}</div>}
                    </div>
                    {l.link_categories && (
                      <Badge variant="secondary" style={{ backgroundColor: (l.link_categories.color || "") + "20" }}>{l.link_categories.name}</Badge>
                    )}
                  </div>
                  <div className="flex gap-1 mt-2">
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(l.url); toast.success("Link copiado"); }}>
                      <Copy className="h-3 w-3 mr-1" />Copiar
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={l.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3 mr-1" />Abrir</a>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(l.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <p className="text-muted-foreground">Nenhum link ainda. Adicione o primeiro.</p>}
    </div>
  );
}
