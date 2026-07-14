import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { MiniCalendar } from "@/components/MiniCalendar";
import { SemanticBadge } from "@/components/SemanticBadge";
import {
  Calendar,
  Contact,
  ArrowRight,
  AlertTriangle,
  Clock,
  Briefcase,
  AlertCircle,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const today = new Date();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cockpit Operacional</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            Novo Evento
          </Button>
          <Button size="sm">Nova Pendência</Button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Como está meu dia?"
          value="5"
          icon={Briefcase}
          variant="neutral"
        />
        <StatCard
          title="O que precisa de atenção?"
          value="3"
          icon={AlertCircle}
          variant="pending"
        />
        <StatCard
          title="O que venceu?"
          value="1"
          icon={AlertTriangle}
          variant="critical"
        />
        <StatCard
          title="Ações Rápidas"
          value="2"
          icon={Zap}
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
              <div className="divide-y divide-border/40">
                <div className="p-4 flex items-center justify-between hover:bg-white/50 transition-colors">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-sm flex items-center gap-2">
                      Mentoria Turma 4 <SemanticBadge variant="success">Confirmed</SemanticBadge>
                    </span>
                    <span className="text-xs text-muted-foreground">14:00 - 15:30 • Zoom</span>
                  </div>
                  <Button size="sm" variant="secondary">
                    Entrar
                  </Button>
                </div>
                <div className="p-4 flex items-center justify-between hover:bg-white/50 transition-colors">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-sm flex items-center gap-2">
                      Revisão de Conteúdo (Lote 2) <SemanticBadge variant="pending">Draft</SemanticBadge>
                    </span>
                    <span className="text-xs text-muted-foreground">16:00 - 17:00</span>
                  </div>
                  <Button size="sm" variant="secondary">
                    Abrir
                  </Button>
                </div>
              </div>
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
              <div className="divide-y divide-border/40">
                <div className="p-4 flex items-start gap-3 hover:bg-white/50 transition-colors">
                  <div className="mt-1">
                    <SemanticBadge variant="critical">Conflito</SemanticBadge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-sm">Conflito de Agenda Detectado</span>
                    <span className="text-xs text-muted-foreground">
                      Mentoria coincide com consulta presencial amanhã às 14:00.
                    </span>
                    <Button size="sm" variant="link" className="px-0 h-auto justify-start text-xs text-primary">
                      Resolver conflito
                    </Button>
                  </div>
                </div>
                <div className="p-4 flex items-start gap-3 hover:bg-white/50 transition-colors">
                  <div className="mt-1">
                    <SemanticBadge variant="pending">Leads</SemanticBadge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-sm">2 novos leads do Instagram</span>
                    <span className="text-xs text-muted-foreground">
                      Tempo de resposta atual: 4h.
                    </span>
                    <Button size="sm" variant="link" className="px-0 h-auto justify-start text-xs text-primary">
                      Iniciar atendimento
                    </Button>
                  </div>
                </div>
              </div>
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
              <Button variant="secondary" className="justify-start gap-3 w-full bg-white hover:bg-muted" asChild>
                <Link to="/agenda">
                  <Calendar className="h-4 w-4 text-[var(--semantic-pending-fg)]" /> Planejar Semana
                </Link>
              </Button>
              <Button variant="secondary" className="justify-start gap-3 w-full bg-white hover:bg-muted" asChild>
                <Link to="/crm">
                  <Contact className="h-4 w-4 text-[var(--semantic-success-fg)]" /> Retornar Contatos
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
