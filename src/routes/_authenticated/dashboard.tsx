import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAgendaEvents } from "@/lib/google-calendar.functions";
import type { AgendaEvent } from "@/features/agenda/model/agenda-event";
import { useClients } from "@/features/clients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { MiniCalendar } from "@/components/MiniCalendar";
import { SemanticBadge } from "@/components/SemanticBadge";
import type { SemanticVariant } from "@/components/StatCard";
import {
  Calendar,
  Contact,
  AlertTriangle,
  Clock,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Users,
} from "lucide-react";
import { format, isSameDay, isBefore, addDays, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const EVENT_STATUS_VARIANT: Record<string, SemanticVariant> = {
  confirmed: "success",
  completed: "success",
  pending: "pending",
  draft: "pending",
  cancelled: "critical",
  rescheduled: "critical",
};

const EVENT_STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmado",
  completed: "Concluído",
  pending: "Pendente",
  draft: "Rascunho",
  cancelled: "Cancelado",
  rescheduled: "Remarcado",
};

function DashboardPage() {
  const today = new Date();

  const eventsQuery = useQuery({
    queryKey: ["dashboard-events", today.toDateString()],
    queryFn: async () => {
      const res = await getAgendaEvents({
        data: { from: today.toISOString(), to: endOfDay(addDays(today, 7)).toISOString() },
      });
      return res.events as AgendaEvent[];
    },
  });

  const clientsQuery = useClients();

  const upcomingEvents = (eventsQuery.data ?? [])
    .filter((e) => !isBefore(new Date(e.endsAt), today))
    .slice(0, 4);
  const todaysEventsCount = (eventsQuery.data ?? []).filter((e) =>
    isSameDay(new Date(e.startsAt), today),
  ).length;
  const conflictEvents = (eventsQuery.data ?? []).filter(
    (e) => (e.conflictWarnings?.length ?? 0) > 0,
  );

  const clients = clientsQuery.data ?? [];
  const newLeads = clients.filter((c) => c.status === "novo");
  const overdueFollowUps = clients.filter(
    (c) => c.next_contact_at && isBefore(new Date(c.next_contact_at), today),
  );
  const inProgress = clients.filter((c) => c.status === "em contato");

  const hasAlerts = conflictEvents.length > 0 || overdueFollowUps.length > 0 || newLeads.length > 0;
  const dataLoading = eventsQuery.isLoading || clientsQuery.isLoading;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-editorial tracking-tight">Cockpit Operacional</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link to="/agenda">Ver agenda</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/crm">Novo dossiê</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Compromissos hoje"
          value={dataLoading ? "–" : todaysEventsCount}
          icon={Briefcase}
          variant="neutral"
        />
        <StatCard
          title="Novos contatos aguardando"
          value={dataLoading ? "–" : newLeads.length}
          icon={AlertCircle}
          variant="pending"
        />
        <StatCard
          title="Retornos atrasados"
          value={dataLoading ? "–" : overdueFollowUps.length}
          icon={AlertTriangle}
          variant="critical"
        />
        <StatCard
          title="Em acompanhamento"
          value={dataLoading ? "–" : inProgress.length}
          icon={Users}
          variant="neutral"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-8 space-y-6">
          <Card className="border-none shadow-sm bg-[var(--bg-panel)] overflow-hidden">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Próximos Compromissos
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="h-8">
                  <Link to="/agenda">Ver agenda completa</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {eventsQuery.isLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : eventsQuery.isError ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Não foi possível carregar os próximos compromissos.
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Nenhum compromisso registrado para os próximos dias.
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="p-4 flex items-center justify-between hover:bg-white/50 transition-colors"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="font-medium text-sm flex items-center gap-2 truncate">
                          {event.title}
                          <SemanticBadge variant={EVENT_STATUS_VARIANT[event.status] ?? "neutral"}>
                            {EVENT_STATUS_LABEL[event.status] ?? event.status}
                          </SemanticBadge>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {isSameDay(new Date(event.startsAt), today)
                            ? "Hoje"
                            : format(new Date(event.startsAt), "EEEE, d 'de' MMM", {
                                locale: ptBR,
                              })}
                          {" · "}
                          {event.allDay
                            ? "Dia inteiro"
                            : `${format(new Date(event.startsAt), "HH:mm")} - ${format(new Date(event.endsAt), "HH:mm")}`}
                          {event.location ? ` · ${event.location}` : ""}
                        </span>
                      </div>
                      <Button size="sm" variant="secondary" asChild>
                        <Link to="/agenda">Ver</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-[var(--bg-panel)] overflow-hidden">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Alertas Operacionais
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {dataLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : !hasAlerts ? (
                <div className="p-6 flex items-start gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-[var(--semantic-success-fg)]" />
                  Nenhum alerta no momento. Tudo em ordem.
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {conflictEvents.map((event) => (
                    <div
                      key={event.id}
                      className="p-4 flex items-start gap-3 hover:bg-white/50 transition-colors"
                    >
                      <div className="mt-1">
                        <SemanticBadge variant="critical">Conflito</SemanticBadge>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">{event.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {event.conflictWarnings?.[0]?.message ?? "Conflito de horário detectado."}
                        </span>
                        <Button
                          asChild
                          size="sm"
                          variant="link"
                          className="px-0 h-auto justify-start text-xs text-primary"
                        >
                          <Link to="/agenda">Resolver conflito</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                  {overdueFollowUps.length > 0 && (
                    <div className="p-4 flex items-start gap-3 hover:bg-white/50 transition-colors">
                      <div className="mt-1">
                        <SemanticBadge variant="critical">Atraso</SemanticBadge>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">
                          {overdueFollowUps.length} retorno(s) de cliente atrasado(s)
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {overdueFollowUps
                            .slice(0, 3)
                            .map((c) => c.name)
                            .join(", ")}
                        </span>
                        <Button
                          asChild
                          size="sm"
                          variant="link"
                          className="px-0 h-auto justify-start text-xs text-primary"
                        >
                          <Link to="/crm">Ver dossiês</Link>
                        </Button>
                      </div>
                    </div>
                  )}
                  {newLeads.length > 0 && (
                    <div className="p-4 flex items-start gap-3 hover:bg-white/50 transition-colors">
                      <div className="mt-1">
                        <SemanticBadge variant="pending">Leads</SemanticBadge>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">
                          {newLeads.length} novo(s) contato(s) aguardando atendimento
                        </span>
                        <Button
                          asChild
                          size="sm"
                          variant="link"
                          className="px-0 h-auto justify-start text-xs text-primary"
                        >
                          <Link to="/crm">Iniciar atendimento</Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-4 space-y-6">
          <MiniCalendar />

          <Card className="border-none shadow-sm bg-[var(--bg-panel)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Acesso Rápido
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                variant="secondary"
                className="justify-start gap-3 w-full bg-white hover:bg-muted"
                asChild
              >
                <Link to="/agenda">
                  <Calendar className="h-4 w-4 text-[var(--semantic-pending-fg)]" /> Planejar Semana
                </Link>
              </Button>
              <Button
                variant="secondary"
                className="justify-start gap-3 w-full bg-white hover:bg-muted"
                asChild
              >
                <Link to="/crm">
                  <Contact className="h-4 w-4 text-[var(--semantic-success-fg)]" /> Retornar
                  Contatos
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
