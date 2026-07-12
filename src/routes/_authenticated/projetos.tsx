import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/projetos")({
  component: () => (
    <Stub
      title="Projetos"
      desc="Centrais por projeto com abas de Cronograma, Checklist, Equipe, Arquivos, Financeiro, Marketing e mais."
    />
  ),
});

function Stub({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Em construção — próximo módulo do roadmap.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
