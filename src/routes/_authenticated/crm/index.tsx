import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, FolderX, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useClients,
  useCreateClient,
  useUpdateClient,
  CLIENT_STATUSES,
  type CreateClientInput,
} from "@/features/clients";
import { ClientDossierCard } from "@/features/clients/components/ClientDossierCard";
import {
  ClientStatusBadge,
  clientStatusLabel,
} from "@/features/clients/components/ClientStatusBadge";
import { AlunosPlanilhaTab } from "@/features/clients/components/AlunosPlanilhaTab";

export const Route = createFileRoute("/_authenticated/crm/")({
  component: CrmPage,
});

const EMPTY_FORM: CreateClientInput = {
  name: "",
  phone: "",
  email: "",
  origin: "",
  interest: "",
  status: "novo",
  notes: "",
};

function CrmPage() {
  const { data: clients, isLoading, isError, error } = useClients();
  const createClient = useCreateClient();
  const updateStatus = useUpdateClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateClientInput>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [tab, setTab] = useState("alunos");

  const filtered = useMemo(() => {
    if (!clients) return [];
    const query = search.trim().toLowerCase();
    return clients.filter((c) => {
      const matchesStatus = statusFilter === "todos" || c.status === statusFilter;
      const matchesQuery =
        !query ||
        c.name.toLowerCase().includes(query) ||
        (c.email ?? "").toLowerCase().includes(query) ||
        (c.phone ?? "").toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [clients, search, statusFilter]);

  const byStatus = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    CLIENT_STATUSES.forEach((s) => map.set(s, []));
    filtered.forEach((c) => {
      if (!map.has(c.status)) map.set(c.status, []);
      map.get(c.status)!.push(c);
    });
    return map;
  }, [filtered]);

  function handleCreate() {
    createClient.mutate(form, {
      onSuccess: () => {
        toast.success("Dossiê criado");
        setOpen(false);
        setForm(EMPTY_FORM);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-editorial tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dossiês de contatos e acompanhamento do relacionamento com o Instituto.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Novo dossiê
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo dossiê de cliente</DialogTitle>
              <DialogDescription>
                Registre os dados iniciais de contato. Você poderá completar o dossiê depois.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="client-name">Nome</Label>
                <Input
                  id="client-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="client-phone">Telefone</Label>
                <Input
                  id="client-phone"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="client-email">E-mail</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="client-origin">Origem</Label>
                <Input
                  id="client-origin"
                  value={form.origin ?? ""}
                  onChange={(e) => setForm({ ...form, origin: e.target.value })}
                  placeholder="Instagram, Indicação..."
                />
              </div>
              <div>
                <Label htmlFor="client-interest">Interesse</Label>
                <Input
                  id="client-interest"
                  value={form.interest ?? ""}
                  onChange={(e) => setForm({ ...form, interest: e.target.value })}
                  placeholder="Congresso, Formação..."
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="client-status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger id="client-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {clientStatusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="client-notes">Notas</Label>
                <Textarea
                  id="client-notes"
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!form.name || createClient.isPending}>
                {createClient.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Salvar dossiê"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {tab !== "alunos" && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou telefone..."
              className="h-11 pl-9 text-base"
              aria-label="Buscar clientes"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]" aria-label="Filtrar por status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {CLIENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {clientStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isError ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-card py-16 text-center">
          <AlertTriangle className="h-6 w-6 text-[var(--semantic-critical-fg)]" />
          <p className="font-medium">Não foi possível carregar os dossiês.</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            {error instanceof Error ? error.message : "Tente novamente em instantes."}
          </p>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="alunos">Alunos</TabsTrigger>
            <TabsTrigger value="dossies">Dossiês</TabsTrigger>
            <TabsTrigger value="fluxo">Fluxo por status</TabsTrigger>
          </TabsList>

          <TabsContent value="alunos" className="mt-4">
            <AlunosPlanilhaTab />
          </TabsContent>

          <TabsContent value="dossies" className="mt-4">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[74px] w-full rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState hasClients={(clients?.length ?? 0) > 0} />
            ) : (
              <div className="space-y-2">
                {filtered.map((c) => (
                  <ClientDossierCard key={c.id} client={c} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="fluxo" className="mt-4">
            {isLoading ? (
              <div className="grid gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState hasClients={(clients?.length ?? 0) > 0} />
            ) : (
              <div className="grid gap-3 md:grid-cols-4">
                {[...byStatus.entries()].map(([status, list]) => (
                  <div key={status} className="rounded-lg bg-muted/40 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <ClientStatusBadge status={status} />
                      <span className="text-xs text-muted-foreground">{list.length}</span>
                    </div>
                    <div className="space-y-2">
                      {list.map((c) => (
                        <div key={c.id} className="rounded-md border border-border/60 bg-card p-3">
                          <div className="font-editorial text-sm">{c.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground truncate">
                            {c.phone || c.email || "Sem contato registrado"}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {CLIENT_STATUSES.filter((s) => s !== c.status).map((s) => (
                              <Button
                                key={s}
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[11px]"
                                onClick={() => updateStatus.mutate({ id: c.id, status: s })}
                              >
                                → {clientStatusLabel(s)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function EmptyState({ hasClients }: { hasClients: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/70 bg-card/60 py-16 text-center">
      <FolderX className="h-6 w-6 text-muted-foreground" />
      <p className="font-medium">
        {hasClients
          ? "Nenhum dossiê encontrado para esta busca."
          : "Nenhum dossiê registrado ainda."}
      </p>
      <p className="text-sm text-muted-foreground max-w-sm">
        {hasClients
          ? "Ajuste os filtros ou o termo de busca."
          : "Cadastre o primeiro contato para iniciar o acompanhamento."}
      </p>
    </div>
  );
}
