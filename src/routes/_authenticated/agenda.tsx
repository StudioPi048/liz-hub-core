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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, Calendar as CalIcon, AlertTriangle, Clock, Users, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { format, startOfDay, endOfDay, addDays, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AgendaEvent } from "@/features/agenda/model/agenda-event";
import { useAgendaPreferences } from "@/features/agenda/hooks/useAgendaPreferences";
import { AgendaFiltersBar } from "@/features/agenda/components/AgendaFiltersBar";
import { filterAgendaEvents } from "@/features/agenda/utils/agenda-filters";
import { MonthGrid } from "@/features/agenda/views/MonthGrid";
import { TrimestralGrid } from "@/features/agenda/views/TrimestralGrid";
import { TimelineView } from "@/features/agenda/views/TimelineView";

const searchSchema = z.object({
  google_connected: z.string().optional(),
  google_error: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/agenda")({
  validateSearch: searchSchema,
  component: AgendaPage,
});

export function AgendaPage() {
  const search = useSearch({ from: "/_authenticated/agenda" });
  const qc = useQueryClient();
  const { prefs, updatePrefs, updateFilters } = useAgendaPreferences();
  const [showFilters, setShowFilters] = useState(false);

  const view = prefs.view;
  const focusDate = new Date(prefs.focusDate);

  useEffect(() => {
    if (search.google_connected) {
      toast.success("Google Calendar conectado!");
      qc.invalidateQueries({ queryKey: ["google-status"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    }
    if (search.google_error) {
      toast.error("Erro ao conectar Google: " + search.google_error);
    }
  }, [search, qc]);

  const status = useQuery({ queryKey: ["google-status"], queryFn: () => getGoogleStatus() });
  const googleConnectionStatus = status.data?.status;

  // Calculate Date Boundaries based on view and focusDate
  let fromDate = startOfDay(focusDate);
  let toDate = endOfDay(focusDate);

  if (view === 'today') {
    // defaults above
  } else if (view === 'tomorrow') {
    fromDate = startOfDay(addDays(focusDate, 1));
    toDate = endOfDay(addDays(focusDate, 1));
  } else if (view === 'week') {
    fromDate = startOfWeek(focusDate, { weekStartsOn: 0 });
    toDate = endOfWeek(focusDate, { weekStartsOn: 0 });
  } else if (view === 'month') {
    // Include full grid
    fromDate = startOfWeek(startOfMonth(focusDate), { weekStartsOn: 0 });
    toDate = endOfWeek(endOfMonth(focusDate), { weekStartsOn: 0 });
  } else if (view === 'quarter') {
    fromDate = startOfWeek(startOfMonth(focusDate), { weekStartsOn: 0 });
    toDate = endOfWeek(endOfMonth(addMonths(focusDate, 2)), { weekStartsOn: 0 });
  } else if (view === '30d') {
    fromDate = startOfDay(focusDate);
    toDate = endOfDay(addDays(focusDate, 30));
  } else if (view === '90d') {
    fromDate = startOfDay(focusDate);
    toDate = endOfDay(addDays(focusDate, 90));
  } else if (view === 'timeline') {
    fromDate = startOfDay(focusDate);
    toDate = endOfDay(addMonths(focusDate, 6));
  }

  // NOTE: In the future we will call an internal Supabase function that queries `agenda_events`
  // AND merges with `listRangeEvents` dynamically. For now, we adapt what we have.
  const eventsQuery = useQuery({
    queryKey: ["events", fromDate.toISOString(), toDate.toISOString(), googleConnectionStatus],
    enabled: googleConnectionStatus === "connected",
    queryFn: async () => {
      // Mocked adapter for current google events -> AgendaEvent
      const res = await listRangeEvents({ data: { from: fromDate.toISOString(), to: toDate.toISOString() } });
      const rawEvents: any[] = res.events || [];
      const adapted: AgendaEvent[] = rawEvents.map(e => ({
        id: e.id,
        source: "google",
        title: e.summary || "(Sem Título)",
        description: e.description,
        startsAt: e.start,
        endsAt: e.end,
        allDay: e.allDay,
        timezone: "America/Sao_Paulo", // MOCK
        calendarId: e.calendarId,
        calendarName: e.calendarSummary,
        location: e.location,
        isEditable: false,
        isExternal: true,
        visibility: "internal",
        isBlocking: true,
        isRecurring: false,
        status: "confirmed"
      }));
      return { events: adapted };
    },
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const getUrl = useServerFn(getGoogleAuthUrl);
  const disconnect = useMutation({
    mutationFn: () => disconnectGoogle(),
    onSuccess: () => {
      toast.success("Google desconectado");
      qc.invalidateQueries({ queryKey: ["google-status"] });
      qc.removeQueries({ queryKey: ["events"] });
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

  const allEvents = eventsQuery.data?.events || [];
  const filteredEvents = filterAgendaEvents(allEvents, prefs.filters);

  // Navigation handlers
  const handlePrevious = () => {
    if (view === 'month') updatePrefs({ focusDate: subMonths(focusDate, 1).toISOString() });
    else if (view === 'quarter') updatePrefs({ focusDate: subMonths(focusDate, 3).toISOString() });
    else if (view === 'week') updatePrefs({ focusDate: addDays(focusDate, -7).toISOString() });
    else updatePrefs({ focusDate: addDays(focusDate, -1).toISOString() });
  };
  const handleNext = () => {
    if (view === 'month') updatePrefs({ focusDate: addMonths(focusDate, 1).toISOString() });
    else if (view === 'quarter') updatePrefs({ focusDate: addMonths(focusDate, 3).toISOString() });
    else if (view === 'week') updatePrefs({ focusDate: addDays(focusDate, 7).toISOString() });
    else updatePrefs({ focusDate: addDays(focusDate, 1).toISOString() });
  };
  const handleToday = () => updatePrefs({ focusDate: new Date().toISOString() });

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)] overflow-hidden">
      
      {/* COCKPIT SIDEBAR */}
      {prefs.isSidebarOpen && (
        <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4 overflow-y-auto pr-2 pb-8">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg tracking-tight">Painel de Bordo</h2>
            {status.data?.status === "connected" ? (
              <Badge variant="outline" className="text-green-600 bg-green-500/10 border-green-500/20">Sincronizado</Badge>
            ) : status.data?.status === "temporarily_unavailable" ? (
              <Badge variant="outline" className="text-yellow-600 bg-yellow-500/10 border-yellow-500/20">Indisponível</Badge>
            ) : (
              <Badge variant="outline" className="text-orange-600 bg-orange-500/10 border-orange-500/20">Desconectado</Badge>
            )}
          </div>
          
          {status.data?.status === "disconnected" && (
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-orange-700">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-semibold text-sm">Google Calendar</span>
                </div>
                <p className="text-xs text-orange-700/80">Sua agenda externa está desconectada. Conecte para visualizar eventos.</p>
                <Button size="sm" className="w-full bg-orange-600 hover:bg-orange-700 text-white" onClick={connect}>
                  Conectar Agora
                </Button>
              </CardContent>
            </Card>
          )}

          {status.data?.status === "needs_reconnect" && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-semibold text-sm">Conexão Expirada</span>
                </div>
                <p className="text-xs text-red-700/80">A conexão com o Google Calendar expirou ou ficou inválida. Reconecte sua conta para voltar a visualizar os eventos externos.</p>
                <Button size="sm" className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={connect}>
                  Reconectar Conta
                </Button>
              </CardContent>
            </Card>
          )}

          {status.data?.status === "temporarily_unavailable" && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-yellow-700">
                  <Clock className="h-4 w-4" />
                  <span className="font-semibold text-sm">Aviso de Sincronização</span>
                </div>
                <p className="text-xs text-yellow-700/80">O servidor do Google está temporariamente indisponível. Seus eventos externos podem estar desatualizados.</p>
                <Button size="sm" variant="outline" className="w-full" onClick={() => status.refetch()}>
                  Tentar Novamente
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Hoje</div>
                <div className="text-2xl font-semibold">
                  {allEvents.filter(e => format(new Date(e.startsAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-orange-500/5 border-orange-500/20">
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Pendências</div>
                <div className="text-2xl font-semibold text-orange-600">0</div>
              </CardContent>
            </Card>
          </div>
        </aside>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background rounded-lg border shadow-sm">
        <header className="p-3 border-b flex flex-wrap items-center gap-2 justify-between bg-muted/20">
          <div className="flex gap-1 overflow-x-auto hide-scrollbar">
            {(['today', 'week', 'month', 'quarter', '30d', '90d'] as const).map(v => (
              <Button
                key={v}
                variant={view === v ? "secondary" : "ghost"}
                size="sm"
                onClick={() => updatePrefs({ view: v })}
                className={view === v ? "bg-background shadow-sm" : ""}
              >
                {v === 'today' ? 'Hoje' : 
                 v === 'week' ? 'Semana' : 
                 v === 'month' ? 'Mês' : 
                 v === 'quarter' ? 'Trimestre' :
                 v === '30d' ? '30 Dias' : '90 Dias'}
              </Button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-background border rounded-md p-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" onClick={handlePrevious}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" className="h-7 rounded-sm text-xs" onClick={handleToday}>Hoje</Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
            </div>

            <Button variant={showFilters ? "secondary" : "outline"} size="sm" className="h-8" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-3.5 w-3.5 mr-2" />
              Filtros
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => eventsQuery.refetch()}
              disabled={eventsQuery.isFetching}
              title="Sincronizar"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${eventsQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </header>

        {showFilters && (
          <AgendaFiltersBar 
            filters={prefs.filters} 
            onChange={updateFilters} 
            onClear={() => updatePrefs({ filters: { query: "", categories: [], responsibleIds: [], sources: [], statuses: [], modalities: [], cities: [], countries: [], calendarIds: [] }})} 
            availableEvents={allEvents} 
          />
        )}

        <div className="flex-1 overflow-y-auto p-4 bg-muted/5">
          {eventsQuery.isLoading && (
            <div className="flex justify-center p-8 text-muted-foreground text-sm">Sincronizando radares operacionais...</div>
          )}
          
          {!eventsQuery.isLoading && (
            <>
              {view === 'month' && <MonthGrid currentDate={focusDate} events={filteredEvents} />}
              {view === 'quarter' && <TrimestralGrid currentDate={focusDate} events={filteredEvents} />}
              {(view === '30d' || view === '90d' || view === 'week' || view === 'today' || view === 'tomorrow' || view === 'timeline') && (
                <TimelineView events={filteredEvents} showStrategicHighlights={view === '90d'} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
