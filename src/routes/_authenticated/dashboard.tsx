import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Link2, FileText, Contact, ArrowRight, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const today = new Date();
  
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cockpit Operacional</h1>
          <p className="text-sm text-muted-foreground">
            {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Novo Evento
          </Button>
          <Button size="sm">
            Nova Pendência
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 rounded-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Como está meu dia?</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground mt-1">2 consultas, 1 reunião, 2 pendências</p>
            <Button variant="link" size="sm" className="px-0 h-auto mt-2" asChild>
              <Link to="/agenda">Ver agenda de hoje <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 rounded-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">O que precisa de atenção?</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-orange-600">3</div>
            <p className="text-xs text-muted-foreground mt-1">Contatos CRM aguardando retorno</p>
            <Button variant="link" size="sm" className="px-0 h-auto mt-2" asChild>
              <Link to="/crm">Abrir leads <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 rounded-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">O que venceu?</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-red-600">1</div>
            <p className="text-xs text-muted-foreground mt-1">Fatura em atraso</p>
            <Button variant="link" size="sm" className="px-0 h-auto mt-2 text-red-600" asChild>
              <Link to="/financeiro">Resolver pendências <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 rounded-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 flex flex-col gap-2">
            <Button variant="outline" size="sm" className="justify-start" asChild>
              <Link to="/agenda"><Calendar className="h-4 w-4 mr-2" /> Planejar Semana</Link>
            </Button>
            <Button variant="outline" size="sm" className="justify-start" asChild>
              <Link to="/crm"><Contact className="h-4 w-4 mr-2" /> Retornar Contatos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="border-b bg-muted/20 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" /> Próximos Compromissos
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-8">
                <Link to="/agenda">Ver todos</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              <div className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                <div className="flex flex-col">
                  <span className="font-medium text-sm">Mentoria Turma 4</span>
                  <span className="text-xs text-muted-foreground">14:00 - 15:30 • Zoom</span>
                </div>
                <Button size="sm" variant="secondary">Entrar</Button>
              </div>
              <div className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                <div className="flex flex-col">
                  <span className="font-medium text-sm">Revisão de Conteúdo (Lote 2)</span>
                  <span className="text-xs text-muted-foreground">16:00 - 17:00</span>
                </div>
                <Button size="sm" variant="secondary">Abrir</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b bg-muted/20 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Alertas Operacionais
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
             <div className="divide-y">
              <div className="p-4 flex items-start gap-3 hover:bg-muted/10 transition-colors">
                <div className="mt-0.5"><div className="h-2 w-2 rounded-full bg-red-500" /></div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm">Conflito de Agenda Detectado</span>
                  <span className="text-xs text-muted-foreground">Mentoria coincide com consulta presencial amanhã às 14:00.</span>
                  <Button size="sm" variant="link" className="px-0 h-auto justify-start text-xs">Resolver conflito</Button>
                </div>
              </div>
              <div className="p-4 flex items-start gap-3 hover:bg-muted/10 transition-colors">
                <div className="mt-0.5"><div className="h-2 w-2 rounded-full bg-orange-500" /></div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm">2 novos leads do Instagram</span>
                  <span className="text-xs text-muted-foreground">Tempo de resposta atual: 4h.</span>
                  <Button size="sm" variant="link" className="px-0 h-auto justify-start text-xs">Iniciar atendimento</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
