import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/arquivos")({ component: () => (
  <div className="max-w-3xl">
    <Card>
      <CardHeader><CardTitle>Biblioteca de Arquivos</CardTitle><CardDescription>Upload e organização por projeto (PNG, PDF, vídeos, contratos).</CardDescription></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">Em construção.</p></CardContent>
    </Card>
  </div>
) });
