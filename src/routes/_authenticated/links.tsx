import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useLinks,
  useLinkCategories,
  useCreateLink,
  useDeleteLink,
  useUpdateLink,
} from "@/features/links";
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
import { SemanticBadge } from "@/components/SemanticBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Copy, ExternalLink, FileText, Plus, Search, Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/links")({
  component: LinksPage,
});

const PREDEFINED_VARIANTS: Record<
  string,
  "neutral" | "pending" | "success" | "critical" | "forms"
> = {
  Hotmart: "neutral",
  "Plataformas LIZ": "pending",
  "Redes Sociais": "success",
  Design: "critical",
  Formulários: "forms",
};

function getCategoryVariant(name: string) {
  if (PREDEFINED_VARIANTS[name]) return PREDEFINED_VARIANTS[name];
  const variants = ["neutral", "pending", "success", "critical"] as const;
  return variants[name.length % variants.length];
}

function getNoteTags(notes: string | null) {
  if (!notes) return [];
  return notes
    .split(/\s+/)
    .filter((tag) => tag.startsWith("#"))
    .map((tag) => tag.replace(/^#/, "").replace(/-/g, " "));
}

function LinksPage() {
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", category_id: "", notes: "" });
  const [openEdit, setOpenEdit] = useState(false);
  const [editForm, setEditForm] = useState<{
    id: string;
    name: string;
    url: string;
    category_id: string;
    notes: string;
  }>({ id: "", name: "", url: "", category_id: "", notes: "" });

  const { data: catsData, isLoading: isLoadingCats, error: errorCats } = useLinkCategories();
  const { data: linksData, isLoading: isLoadingLinks, error: errorLinks } = useLinks();

  const create = useCreateLink();
  const del = useDeleteLink();
  const update = useUpdateLink();

  const openEditFor = (l: LinkWithCategory) => {
    setEditForm({
      id: l.id,
      name: l.name,
      url: l.url,
      category_id: l.category_id || "",
      notes: l.notes || "",
    });
    setOpenEdit(true);
  };

  const handleUpdate = () => {
    update.mutate(
      {
        id: editForm.id,
        name: editForm.name,
        url: editForm.url,
        category_id: editForm.category_id || null,
        notes: editForm.notes || null,
      },
      {
        onSuccess: () => {
          toast.success("Link atualizado");
          setOpenEdit(false);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

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
    del.mutate(id, {
      onSuccess: () => toast.success("Removido"),
      onError: (e: Error) => toast.error(e.message),
    });
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
      l.url.toLowerCase().includes(q.toLowerCase()) ||
      (l.notes || "").toLowerCase().includes(q.toLowerCase()),
  );

  const byCategory = new Map<string, typeof filtered>();
  for (const l of filtered) {
    const key = l.link_categories?.name || "Sem categoria";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(l);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap gap-4 justify-between items-start">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-editorial tracking-tight text-foreground">
            Biblioteca de Links
          </h1>
          <p className="text-muted-foreground font-medium">
            Todos os links do Instituto em um só lugar.
          </p>
        </div>
        <div className="flex gap-3 flex-1 md:flex-none md:w-96">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar link..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 bg-background/50 backdrop-blur-sm"
            />
          </div>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button className="shadow-sm">
                <Plus className="h-4 w-4 mr-1" />
                Novo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo link</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
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
                <div className="space-y-2">
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
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-10">
          {[...byCategory.entries()].map(([cat, list]) => (
            <section key={cat} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-primary/25 pl-3">
                <div className="flex items-center gap-2">
                  {cat === "Formulários" && (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--semantic-forms-bg)] text-[var(--semantic-forms-fg)]">
                      <FileText className="h-4 w-4" />
                    </span>
                  )}
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                      {cat}
                    </h2>
                    <p className="text-xs text-muted-foreground/80">
                      {list.length} {list.length === 1 ? "link cadastrado" : "links cadastrados"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
                {list.map((l) => {
                  const tags = getNoteTags(l.notes);

                  return (
                    <Card
                      key={l.id}
                      className="group bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                    >
                      <CardContent className="p-5 flex min-h-64 flex-col gap-5">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {l.link_categories && (
                              <SemanticBadge variant={getCategoryVariant(l.link_categories.name)}>
                                {l.link_categories.name}
                              </SemanticBadge>
                            )}
                            {tags.includes("2026") && (
                              <SemanticBadge variant="pending">2026</SemanticBadge>
                            )}
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                              {l.name}
                            </h3>
                            <div className="w-fit max-w-full rounded-md bg-muted/35 px-2 py-1 text-xs font-mono text-muted-foreground/80 truncate">
                              {l.url}
                            </div>
                          </div>
                        </div>

                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {tags
                              .filter((tag) => tag !== "2026" && tag !== "formulario")
                              .slice(0, 7)
                              .map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border border-border/60 bg-background/60 px-2 py-1 text-xs leading-none text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                          </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t border-border/40 mt-auto">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1 gap-2 shadow-sm"
                            asChild
                          >
                            <a href={l.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                              Abrir
                            </a>
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(l.url);
                              toast.success("Link copiado");
                            }}
                            title="Copiar link"
                          >
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => openEditFor(l)}
                            title="Editar link"
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                className="shrink-0 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors"
                                disabled={del.isPending}
                                title="Remover link"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover "{l.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Este link será removido de vez. Isso não pode ser desfeito.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(l.id)}>
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-2xl bg-muted/10">
              <p className="text-muted-foreground text-lg">Nenhum link encontrado.</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={editForm.url}
                onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={editForm.category_id}
                onValueChange={(v) => setEditForm({ ...editForm, category_id: v })}
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
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={editForm.notes || ""}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleUpdate}
              disabled={!editForm.name || !editForm.url || update.isPending}
            >
              {update.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Salvar alterações"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
