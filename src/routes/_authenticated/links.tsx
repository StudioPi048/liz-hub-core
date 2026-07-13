import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLinks, useLinkCategories, useCreateLink, useDeleteLink, useUpdateLink } from "@/features/links";
import type { LinkWithCategory } from "@/features/links";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Copy, ExternalLink, Plus, Search, Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/links")({
  component: LinksPage,
});

function LinksPage() {
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", category_id: "", notes: "" });

  const { data: catsData, isLoading: isLoadingCats, error: errorCats } = useLinkCategories();
  const { data: linksData, isLoading: isLoadingLinks, error: errorLinks } = useLinks();

  const create = useCreateLink();
  const del = useDeleteLink();

  const handleCreate = () => {
    create.mutate(
      {
        name: form.name,
        url: form.url,
        category_id: form.category_id || null,
        notes: form.notes || null,
      },
      {
        onSuccess: () => {
          toast.success("Link adicionado");
          setOpenNew(false);
          setForm({ name: "", url: "", category_id: "", notes: "" });
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const handleDelete = (id: string) => {
    if (confirm("Remover?")) {
      del.mutate(id, {
        onSuccess: () => toast.success("Removido"),
        onError: (e: Error) => toast.error(e.message),
      });
    }
  };

  if (errorLinks || errorCats) {
    return (
      <div className="p-4 text-destructive">
        Erro ao carregar links. Por favor, recarregue a página.
      </div>
    );
  }

  const filtered = (linksData || []).filter(
    (l) =>
      !q ||
      l.name.toLowerCase().includes(q.toLowerCase()) ||
      l.url.toLowerCase().includes(q.toLowerCase()),
  );

  const byCategory = new Map<string, typeof filtered>();
  for (const l of filtered) {
    const key = l.link_categories?.name || "Sem categoria";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(l);
  }

  return (
    <div className="liz-archive-theme min-h-[calc(100vh-4rem)] p-2 space-y-4 max-w-6xl">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div>
          <h1 className="text-3xl font-editorial tracking-tight text-archive-fg">
            Biblioteca de Links
          </h1>
          <p className="text-sm text-archive-muted">Todos os links do Instituto em um só lugar.</p>
        </div>
        <div className="flex gap-2 flex-1 md:flex-none md:w-96">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar link..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Novo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo link</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>URL</Label>
                  <Input
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={form.category_id}
                    onValueChange={(v) => setForm({ ...form, category_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingCats ? "Carregando..." : "Selecione"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(catsData || []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={form.notes || ""}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreate}
                  disabled={!form.name || !form.url || create.isPending}
                >
                  {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoadingLinks ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {[...byCategory.entries()].map(([cat, list]) => (
            <div key={cat}>
              <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider text-archive-muted">
                {cat}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((l) => (
                  <Card
                    key={l.id}
                    className="bg-archive-surface border-archive-border shadow-sm hover:border-archive-accent transition-colors"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{l.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{l.url}</div>
                          {l.notes && (
                            <div className="text-xs mt-1 text-muted-foreground">{l.notes}</div>
                          )}
                        </div>
                        {l.link_categories && (
                          <Badge
                            variant="secondary"
                            style={{ backgroundColor: (l.link_categories.color || "") + "20" }}
                          >
                            {l.link_categories.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(l.url);
                            toast.success("Link copiado");
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={l.url} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Abrir
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(l.id)}
                          disabled={del.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-muted-foreground">Nenhum link encontrado.</p>
          )}
        </>
      )}
    </div>
  );
}
