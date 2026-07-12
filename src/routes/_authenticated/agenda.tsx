import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  getGoogleStatus,
  getGoogleAuthUrl,
  disconnectGoogle,
  listRangeEvents,
} from "@/lib/google-calendar.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, Calendar as CalIcon, ExternalLink, Unlink } from "lucide-react";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const searchSchema = z.object({
  google_connected: z.string().optional(),
  google_error: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/agenda")({
  validateSearch: searchSchema,
  component: AgendaPage,
});

function AgendaPage() {
  const search = useSearch({ from: "/_authenticated/agenda" });
  const qc = useQueryClient();
  const [view, setView] = useState<"today" | "week">("today");

  useEffect(() => {
    if (search.google_connected) {
      toast.success("Google Calendar conectado!");
      qc.invalidateQueries();
    }
    if (search.google_error) {
      toast.error("Erro ao conectar Google: " + search.google_error);
    }
  }, [search, qc]);

  const status = useQuery({ queryKey: ["google-status"], queryFn: () => getGoogleStatus() });

  const from = startOfDay(new Date()).toISOString();
  const to = endOfDay(view === "today" ? new Date() : addDays(new Date(), 7)).toISOString();

  const events = useQuery({
    queryKey: ["events", view],
    queryFn: () => listRangeEvents({ data: { from, to } }),
    enabled: !!status.data?.connected,
    refetchInterval: 3 * 60 * 1000, // sincroniza a cada 3 minutos
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const lastSync = events.dataUpdatedAt ? format(new Date(events.dataUpdatedAt), "HH:mm:ss") : null;

  const getUrl = useServerFn(getGoogleAuthUrl);
  const disconnect = useMutation({
    mutationFn: () => disconnectGoogle(),
    onSuccess: () => {
      toast.success("Google desconectado");
      qc.invalidateQueries();
    },
  });

  async function connect() {
    try {
      const { url } = await getUrl({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar OAuth");
    }
  }

  if (!status.data?.connected) {
    return (
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalIcon className="h-5 w-5" /> Agenda
            </CardTitle>
            <CardDescription>
              Conecte seu Google Calendar para começar. O LIZ HUB apenas lê os eventos que você
              autorizar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={connect}>Conectar Google Calendar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const evs = (events.data as any)?.events || [];
  const groups = new Map<string, any[]>();
  for (const ev of evs) {
    const day = ev.start ? format(new Date(ev.start), "yyyy-MM-dd") : "sem-data";
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(ev);
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-sm text-muted-foreground">Conectado: {status.data.googleEmail}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "today" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("today")}
          >
            Hoje
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("week")}
          >
            Próx. 7 dias
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => events.refetch()}
            disabled={events.isFetching}
          >
            <RefreshCcw className={`h-4 w-4 mr-1 ${events.isFetching ? "animate-spin" : ""}`} />
            Sincronizar agora
          </Button>
          <Button variant="ghost" size="sm" onClick={() => disconnect.mutate()}>
            <Unlink className="h-4 w-4 mr-1" />
            Desconectar
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Sincronização automática a cada 3 min{lastSync ? ` · última: ${lastSync}` : ""}
      </p>

      {events.isLoading && <p className="text-sm text-muted-foreground">Carregando eventos...</p>}
      {evs.length === 0 && !events.isLoading && (
        <p className="text-muted-foreground">Nenhum evento no período.</p>
      )}

      {[...groups.entries()].map(([day, list]) => (
        <div key={day}>
          <h2 className="text-sm font-semibold mb-2 capitalize">
            {day === "sem-data"
              ? "Sem data"
              : format(new Date(day), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h2>
          <div className="space-y-2">
            {list.map((ev: any) => (
              <Card
                key={ev.id}
                className="border-l-4"
                style={{ borderLeftColor: ev.color || "#7c3aed" }}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{ev.summary || "(sem título)"}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-2 items-center">
                      {ev.allDay
                        ? "Dia inteiro"
                        : `${format(new Date(ev.start), "HH:mm")} - ${format(new Date(ev.end), "HH:mm")}`}
                      <Badge variant="secondary" className="text-xs">
                        {ev.calendarSummary}
                      </Badge>
                      {ev.location && <span className="truncate">📍 {ev.location}</span>}
                    </div>
                  </div>
                  {ev.htmlLink && (
                    <a
                      href={ev.htmlLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
