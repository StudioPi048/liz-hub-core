import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getKnowledgeDashboardStats } from "@/features/knowledge/api/knowledge.server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Library, BookOpen, GraduationCap, Package, CalendarDays, Users2, Network, HelpCircle, Plus, Upload, CheckCircle2, CopyX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { knowledgeTypeLabels } from "@/features/knowledge/model/knowledge-types";

export const Route = createFileRoute("/_authenticated/acervo/")({
  component: AcervoDashboard,
});

function AcervoDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["knowledge-stats"],
    queryFn: () => getKnowledgeDashboardStats(),
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-editorial tracking-tight">Acervo e Patrimônio Intelectual</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Centro Operacional e Museu do Conhecimento do Instituto LIZ.
        </p>
      </div>

      {/* Acesso Rápido */}
      <div className="flex flex-wrap gap-3">
        <Button variant="default" className="gap-2">
          <Plus className="h-4 w-4" />
          Cadastrar Registro
        </Button>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Importar Dados
        </Button>
        <Button variant="secondary" className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Revisar Pendentes ({stats?.drafts || 0})
        </Button>
        <Button variant="ghost" className="gap-2 text-muted-foreground">
          <CopyX className="h-4 w-4" />
          Localizar Duplicidades
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={knowledgeTypeLabels.book} value={stats?.books} icon={BookOpen} to="/acervo/livros" />
        <StatCard title={knowledgeTypeLabels.course} value={stats?.courses} icon={GraduationCap} to="/acervo/cursos" />
        <StatCard title={knowledgeTypeLabels.product} value={stats?.products} icon={Package} to="/acervo/produtos" />
        <StatCard title={knowledgeTypeLabels.event} value={stats?.events} icon={CalendarDays} to="/acervo/eventos" />
        <StatCard title={knowledgeTypeLabels.author} value={stats?.authors} icon={Users2} to="/acervo/autores" />
        <StatCard title={knowledgeTypeLabels.methodological} value={stats?.concepts} icon={Network} to="/acervo/conceitos" />
        <StatCard title={knowledgeTypeLabels.faq} value={stats?.faq || 0} icon={HelpCircle} to="/acervo/faq" />
        
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Status Editorial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aprovados</span>
                <span className="font-medium">{isLoading ? "-" : stats?.approved}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rascunhos/Revisão</span>
                <span className="font-medium">{isLoading ? "-" : stats?.drafts}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, to }: any) {
  return (
    <Link to={to} className="block transition-transform hover:-translate-y-1">
      <Card className="h-full hover:border-primary/50 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value === undefined ? "-" : value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
