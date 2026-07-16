import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  AlertTriangle,
  FileX2,
  Loader2,
  Save,
  Trash2,
  NotebookText,
  History,
  Plus,
  CalendarClock,
  MapPin,
  Link2,
  FileStack,
} from "lucide-react";
import { toast } from "sonner";
import { useClient, useUpdateClient, useDeleteClient, CLIENT_STATUSES } from "@/features/clients";
import {
  ClientStatusBadge,
  clientStatusLabel,
} from "@/features/clients/components/ClientStatusBadge";
import { formatFullDate, formatRelativeDate } from "@/features/clients/utils/format-date";
import { useClientAgendaEvents } from "@/features/agenda/hooks/use-client-agenda-events";
import { AgendaEventDialog } from "@/features/agenda/components/AgendaEventDialog";

const EVENT_STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmado",
  pending: "Pendente",
  draft: "Rascunho",
  completed: "Concluído",
  rescheduled: "Remarcado",
  cancelled: "Cancelado",
};

export const Route = createFileRoute("/_authenticated/crm/$id")({
  component: ClientDossierPage,
});

function ClientDossierPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: client, isLoading, isError, error } = useClient(id);
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const {
    data: clientEvents,
    isLoading: isLoadingEvents,
    isError: isEventsError,
  } = useClientAgendaEvents(id);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    origin: "",
    interest: "",
    status: "novo",
  });
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name ?? "",
        phone: client.phone ?? "",
        email: client.email ?? "",
        origin: client.origin ?? "",
        interest: client.interest ?? "",
        status: client.status ?? "novo",
      });
      setNotes(client.notes ?? "");
    }
  }, [client]);

  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex max-w-2xl flex-col items-center gap-2 rounded-lg border border-border/60 bg-card py-16 text-center">
        <AlertTriangle className="h-6 w-6 text-[var(--semantic-critical-fg)]" />
        <p className="font-medium">Não foi possível abrir este dossiê.</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          {error instanceof Error ? error.message : "Tente novamente em instantes."}
        </p>
        <Button asChild variant="secondary" className="mt-2">
          <Link to="/crm">Voltar para Clientes</Link>
        </Button>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex max-w-2xl flex-col items-center gap-2 rounded-lg border border-border/60 bg-card py-16 text-center">
        <FileX2 className="h-6 w-6 text-muted-foreground" />
        <p className="font-medium">Este dossiê não foi encontrado.</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Ele pode ter sido removido ou o link está incorreto.
        </p>
        <Button asChild variant="secondary" className="mt-2">
          <Link to="/crm">Voltar para Clientes</Link>
        </Button>
      </div>
    );
  }

  function saveOverview() {
    updateClient.mutate(
      { id, ...form },
      {
        onSuccess: () => toast.success("Dossiê atualizado"),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  function saveNotes() {
    updateClient.mutate(
      { id, notes },
      {
        onSuccess: () => toast.success("Notas salvas"),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  const clientName = client.name;

  function handleDelete() {
    if (!confirm(`Remover o dossiê de "${clientName}"? Esta ação não pode ser desfeita.`)) return;
    deleteClient.mutate(id, {
      onSuccess: () => {
        toast.success("Dossiê removido");
        navigate({ to: "/crm" });
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 h-8 text-muted-foreground">
          <Link to="/crm">
            <ArrowLeft className="h-4 w-4" /> Clientes
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-editorial tracking-tight">{client.name}</h1>
              <ClientStatusBadge status={client.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Dossiê aberto em {formatFullDate(client.created_at) ?? "data não registrada"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--semantic-critical-fg)]"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" /> Remover dossiê
          </Button>
        </div>
      </div>

      <Tabs defaultValue="visao-geral">
        <TabsList>
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="mt-4 space-y-4">
          <div className="rounded-lg border border-border/60 bg-card p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="d-name">Nome</Label>
                <Input
                  id="d-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="d-status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger id="d-status">
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
              <div>
                <Label htmlFor="d-phone">Telefone</Label>
                <Input
                  id="d-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="d-email">E-mail</Label>
                <Input
                  id="d-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="d-origin">Origem</Label>
                <Input
                  id="d-origin"
                  value={form.origin}
                  onChange={(e) => setForm({ ...form, origin: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="d-interest">Interesse</Label>
                <Input
                  id="d-interest"
                  value={form.interest}
                  onChange={(e) => setForm({ ...form, interest: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-4">
              <div className="text-xs text-muted-foreground">
                Último contato: {formatRelativeDate(client.last_contact_at) ?? "sem registro"}
                {client.next_contact_at && (
                  <> · Próximo contato: {formatFullDate(client.next_contact_at)}</>
                )}
              </div>
              <Button size="sm" onClick={saveOverview} disabled={updateClient.isPending}>
                {updateClient.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notas" className="mt-4 space-y-4">
          <div className="rounded-lg border border-border/60 bg-card p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <NotebookText className="h-4 w-4" /> Anotações de acompanhamento
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[180px]"
              placeholder="Este dossiê ainda não possui notas registradas. Registre observações sobre o contato, contexto e acompanhamento."
            />
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={saveNotes} disabled={updateClient.isPending}>
                {updateClient.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar notas
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-4 space-y-6">
          <div className="rounded-lg border border-border/60 bg-card p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <History className="h-4 w-4" /> Compromissos vinculados
              </div>
              <Button size="sm" variant="secondary" onClick={() => setEventDialogOpen(true)}>
                <Plus className="h-4 w-4" /> Novo compromisso
              </Button>
            </div>

            {isLoadingEvents && (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-md" />
                <Skeleton className="h-14 w-full rounded-md" />
              </div>
            )}

            {!isLoadingEvents && isEventsError && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Não foi possível carregar os compromissos deste dossiê. Tente novamente em
                instantes.
              </p>
            )}

            {!isLoadingEvents && !isEventsError && (clientEvents?.length ?? 0) === 0 && (
              <div className="flex flex-col items-center gap-1 py-10 text-center">
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">Nenhum compromisso vinculado a este dossiê.</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Compromissos criados na Agenda e vinculados a este cliente aparecerão aqui
                  automaticamente.
                </p>
              </div>
            )}

            {!isLoadingEvents && !isEventsError && (clientEvents?.length ?? 0) > 0 && (
              <ul className="space-y-2">
                {clientEvents?.map((ev) => (
                  <li
                    key={ev.id}
                    className="rounded-md border border-border/50 bg-background/60 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{ev.title}</p>
                      <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground">
                        {EVENT_STATUS_LABELS[ev.status ?? ""] ?? ev.status}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        {formatFullDate(ev.starts_at) ?? "data não registrada"}
                      </span>
                      {ev.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {ev.location}
                        </span>
                      )}
                      {ev.meeting_url && (
                        <span className="inline-flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          Link online
                        </span>
                      )}
                    </div>
                    {ev.notes && (
                      <p className="mt-2 text-xs text-muted-foreground/90">{ev.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/70 bg-card/60 py-10 text-center">
            <FileStack className="h-5 w-5 text-muted-foreground" />
            <p className="font-medium">Documentos e referências ainda não disponíveis.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              O anexo de documentos, hipóteses genealógicas e relações familiares depende de uma
              estrutura de dados dedicada (tabelas de documentos e de vínculos familiares), ainda
              não implementada no modelo atual do LIZ HUB. Nenhum dado clínico ou genealógico é
              inferido ou exibido nesta versão.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <AgendaEventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        event={null}
        initialClientId={id}
      />
    </div>
  );
}
