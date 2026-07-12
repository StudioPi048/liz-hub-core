import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Link2, FileText, Contact, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TodayCalendarEvents } from "@/components/TodayCalendarEvents";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const today = new Date();
  const greeting = `Hoje é ${format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}`;

  const { data: projects } = useQuery({
    queryKey: ["projects-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .eq("status", "ativo")
        .order("name");
      return data || [];
    },
  });

  const { data: crmCounts } = useQuery({
    queryKey: ["crm-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_contacts").select("status");
      const counts: Record<string, number> = {};
      (data || []).forEach((r) => {
        counts[r.status] = (counts[r.status] || 0) + 1;
      });
      return counts;
    },
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight capitalize">{greeting}</h1>
        <p className="text-muted-foreground">
          Bem-vinda de volta ao Centro de Operações do Instituto LIZ.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickCard to="/agenda" icon={Calendar} label="Agenda" />
        <QuickCard to="/links" icon={Link2} label="Links" />
        <QuickCard to="/textos" icon={FileText} label="Textos" />
        <QuickCard to="/crm" icon={Contact} label="CRM" />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Compromissos de hoje</CardTitle>
              <CardDescription>Direto do seu Google Calendar</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/agenda">
                Abrir agenda <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <TodayCalendarEvents />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CRM</CardTitle>
            <CardDescription>Leads por status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(crmCounts || {}).length === 0 && (
              <p className="text-sm text-muted-foreground">Ainda sem contatos cadastrados.</p>
            )}
            {Object.entries(crmCounts || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="capitalize text-sm">{status}</span>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
            <Button asChild variant="outline" size="sm" className="w-full mt-2">
              <Link to="/crm">Abrir CRM</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Projetos ativos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(projects || []).map((p) => (
            <Card
              key={p.id}
              className="border-l-4"
              style={{ borderLeftColor: p.color || "#7c3aed" }}
            >
              <CardHeader>
                <CardTitle className="text-base">{p.name}</CardTitle>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" size="sm">
                  <Link to="/projetos">Abrir projeto</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickCard({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to} className="block">
      <Card className="hover:border-primary transition-colors">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-brand-soft flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <span className="font-medium">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
