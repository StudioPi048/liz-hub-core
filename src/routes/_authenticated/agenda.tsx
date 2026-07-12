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
import { RefreshCcw, Calendar as CalIcon, ExternalLink, Unlink, AlertTriangle, Clock, MapPin, Video, Users, Search, Filter } from "lucide-react";
import { format, startOfDay, endOfDay, addDays, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

const searchSchema = z.object({
  google_connected: z.string().optional(),
  google_error: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/agenda")({
  validateSearch: searchSchema,
  component: AgendaPage,
});

type ViewMode = 'today' | 'tomorrow' | 'week' | 'month' | '30d' | '90d' | 'timeline';

function AgendaPage() {
  const search = useSearch({ from: "/_authenticated/agenda" });
  const qc = useQueryClient();
  const [view, setView] = useState<ViewMode>(() => {
    return (localStorage.getItem("liz_agenda_view") as ViewMode) || "today";
  });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    localStorage.setItem("liz_agenda_view", view);
  }, [view]);

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
  let toDate = new Date();
  if (view === 'today') toDate = endOfDay(new Date());
  else if (view === 'tomorrow') toDate = endOfDay(addDays(new Date(), 1));
  else if (view === 'week') toDate = endOfDay(addDays(new Date(), 7));
  else if (view === 'month') toDate = endOfDay(addDays(new Date(), 30));
  else if (view === '30d') toDate = endOfDay(addDays(new Date(), 30));
  else if (view === '90d') toDate = endOfDay(addDays(new Date(), 90));
  else if (view === 'timeline') toDate = endOfDay(addMonths(new Date(), 6));

  const events = useQuery({
    queryKey: ["events", view],
    queryFn: () => listRangeEvents({ data: { from, to: toDate.toISOString() } }),
    enabled: !!status.data?.connected,
    refetchInterval: 3 * 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

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
      <div className="max-w-2xl mx-auto mt-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalIcon className="h-5 w-5" /> Conexão do Cockpit Operacional
            </CardTitle>
            <CardDescription>
              A Agenda é o centro operacional do LIZ HUB. Conecte seu Google Calendar para centralizar consultas, cursos, viagens e reuniões.
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
  
  // Client-side search filter
  const filteredEvs = evs.filter((ev: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (ev.summary?.toLowerCase().includes(q) || ev.location?.toLowerCase().includes(q) || ev.description?.toLowerCase().includes(q));
  });

  const groups = new Map<string, any[]>();
  for (const ev of filteredEvs) {
    const day = ev.start ? format(new Date(ev.start), "yyyy-MM-dd") : "sem-data";
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(ev);
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)] overflow-hidden">
      
      {/* COCKPIT SIDEBAR */}
      <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4 overflow-y-auto pr-2 pb-8">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg tracking-tight">Painel de Bordo</h2>
          <Badge variant="outline" className="text-green-600 bg-green-500/10 border-green-500/20">Sincronizado</Badge>
        </div>
        
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar evento, paciente, cidade..." 
            className="pl-9 h-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Hoje</div>
              <div className="text-2xl font-semibold">{evs.filter((e:any) => format(new Date(e.start), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length}</div>
            </CardContent>
          </Card>
          <Card className="bg-orange-500/5 border-orange-500/20">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Pendências</div>
              <div className="text-2xl font-semibold text-orange-600">3</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Próximos Alertas</h3>
          <Card className="border-l-4 border-l-blue-500 rounded-sm">
            <CardContent className="p-3 flex gap-3 items-center">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">Próximo Atendimento</div>
                <div className="text-xs text-muted-foreground">Em 45 minutos</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 rounded-sm">
            <CardContent className="p-3 flex gap-3 items-center">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">Reunião de Diretoria</div>
                <div className="text-xs text-muted-foreground">Amanhã, 10:00</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500 rounded-sm">
            <CardContent className="p-3 flex gap-3 items-center">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">Conflito de Agenda</div>
                <div className="text-xs text-muted-foreground">Sexta-feira (2 sobreposições)</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background rounded-lg border shadow-sm">
        <header className="p-3 border-b flex flex-wrap items-center gap-2 justify-between bg-muted/20">
          <div className="flex gap-1 overflow-x-auto hide-scrollbar">
            {(['today', 'tomorrow', 'week', 'month', '30d', '90d', 'timeline'] as ViewMode[]).map(v => (
              <Button
                key={v}
                variant={view === v ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView(v)}
                className={view === v ? "bg-background shadow-sm" : ""}
              >
                {v === 'today' ? 'Hoje' : 
                 v === 'tomorrow' ? 'Amanhã' : 
                 v === 'week' ? 'Semana' : 
                 v === 'month' ? 'Mês' : 
                 v === '30d' ? '30 Dias' : 
                 v === '90d' ? '90 Dias' : 'Timeline'}
              </Button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="h-3.5 w-3.5 mr-2" />
              Filtros
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => events.refetch()}
              disabled={events.isFetching}
              title="Sincronizar"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${events.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {events.isLoading && (
            <div className="flex justify-center p-8 text-muted-foreground text-sm">Carregando mapa operacional...</div>
          )}
          {filteredEvs.length === 0 && !events.isLoading && (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <CalIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg">Sem compromissos</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Nenhum evento localizado para esta visualização ou termo de busca.
              </p>
            </div>
          )}

          {[...groups.entries()].map(([day, list]) => (
            <div key={day} className="relative">
              <div className="sticky top-0 bg-background/95 backdrop-blur z-10 py-2 border-b mb-3">
                <h2 className="text-sm font-semibold capitalize flex items-center gap-2">
                  {day === "sem-data"
                    ? "Sem data"
                    : format(new Date(day), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                    {list.length} itens
                  </span>
                </h2>
              </div>
              
              <div className="grid gap-2">
                {list.map((ev: any) => {
                  const isOnline = ev.location?.toLowerCase().includes('zoom') || ev.location?.toLowerCase().includes('meet');
                  return (
                    <div 
                      key={ev.id}
                      className="group flex items-start gap-4 p-3 rounded-md border bg-card hover:bg-accent/5 transition-colors"
                    >
                      <div className="w-20 shrink-0 flex flex-col items-end text-sm mt-0.5">
                        <span className="font-medium">
                          {ev.allDay ? "O Dia Todo" : format(new Date(ev.start), "HH:mm")}
                        </span>
                        {!ev.allDay && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(ev.end), "HH:mm")}
                          </span>
                        )}
                      </div>
                      
                      <div className="w-1 shrink-0 rounded-full bg-primary h-full self-stretch min-h-[40px]" style={{ backgroundColor: ev.color || 'hsl(var(--primary))' }} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <h4 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors">
                            {ev.summary || "(sem título)"}
                          </h4>
                          {ev.htmlLink && (
                            <a href={ev.htmlLink} target="_blank" rel="noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground shrink-0">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                        
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                          {ev.location && (
                            <div className="flex items-center gap-1.5 max-w-xs truncate" title={ev.location}>
                              {isOnline ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                              <span className="truncate">{ev.location}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] bg-background">
                              {ev.calendarSummary}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
